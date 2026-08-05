import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BillingService } from './billing.service';

@Injectable()
export class BillingCronService {
  private readonly logger = new Logger(BillingCronService.name);
  private isRunning = false;

  constructor(private readonly billingService: BillingService) {}

  /**
   * Best-effort: em ambiente serverless (Vercel) não há processo persistente
   * entre invocações, então esse cron interno não tem garantia de disparar.
   * Por isso também existe o endpoint público em billing-cron.controller.ts,
   * pensado para ser chamado por um serviço externo (ex.: cron-job.org) no
   * dia 28, no mesmo padrão do NotificationsCronService.
   */
  @Cron('0 6 28 * *', { timeZone: 'America/Sao_Paulo' })
  async handleMonthlyBilling() {
    if (process.env.CRON_BILLING !== 'true') return;
    if (this.isRunning) {
      this.logger.warn('Billing cron already running, skipping');
      return;
    }
    this.isRunning = true;
    try {
      const result = await this.billingService.generateMonthlyInvoices();
      this.logger.log(`Mensalidade gerada: ${result.created}/${result.eligible}`);
    } catch (err) {
      this.logger.error('Error generating monthly invoices', err);
    } finally {
      this.isRunning = false;
    }
  }
}
