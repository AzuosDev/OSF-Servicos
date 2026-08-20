import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import puppeteer, { Browser } from 'puppeteer-core';
import { Budget, BudgetDocument } from './schemas/budget.schema';
import { CompanySettingsService } from './company-settings.service';
import { ClientsService } from './clients.service';
import { buildBudgetHtml } from './pdf/pdf-template';
import { budgetPdfFileName } from './pdf/budget-pdf-filename';

export type GeneratedBudgetPdf = {
  buffer: Buffer;
  /** Nome do arquivo, sem extensão — o cliente é quem decide entre exibir e baixar. */
  fileName: string;
};

@Injectable()
export class PdfService {
  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Budget.name) private readonly budgetModel: Model<BudgetDocument>,
    private readonly clientsService: ClientsService,
    private readonly companySettingsService: CompanySettingsService,
  ) {}

  private async launchBrowser(): Promise<Browser> {
    const isServerless = !!process.env.VERCEL || process.env.NODE_ENV === 'production';

    if (isServerless) {
      const chromium = (await import('@sparticuz/chromium')).default;
      return puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    }

    const executablePath = this.configService.get<string>('PUPPETEER_EXECUTABLE_PATH');
    if (!executablePath) {
      throw new BadRequestException(
        'PUPPETEER_EXECUTABLE_PATH não configurado — aponte para o Chrome/Edge instalado localmente para gerar PDF em desenvolvimento',
      );
    }
    return puppeteer.launch({ executablePath, headless: true });
  }

  async generateBudgetPdf(userId: string, budgetId: string): Promise<GeneratedBudgetPdf> {
    const budget = await this.budgetModel
      .findOne({ _id: new Types.ObjectId(budgetId), userId: new Types.ObjectId(userId) })
      .exec();
    if (!budget) {
      throw new NotFoundException('Orçamento não encontrado');
    }

    const client = await this.clientsService.findOne(userId, budget.clientId.toString());
    const companySettings = await this.companySettingsService.get(userId);

    const html = buildBudgetHtml(budget, client, companySettings);

    let browser: Browser | undefined;
    try {
      browser = await this.launchBrowser();
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
      return {
        buffer: Buffer.from(pdfBuffer),
        fileName: budgetPdfFileName(client.name, budget.createdAt),
      };
    } finally {
      await browser?.close();
    }
  }
}
