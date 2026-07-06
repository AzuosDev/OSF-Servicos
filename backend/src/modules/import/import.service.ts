import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category, CategoryDocument } from '../categories/schemas/category.schema';
import { TransactionsService } from '../transactions/transactions.service';
import { TransactionType } from '../transactions/schemas/transaction.schema';
import { ConfirmImportDto } from './dto/confirm-import.dto';
import { ImportBatch, ImportBatchDocument } from './schemas/import-batch.schema';

export interface ImportCandidate {
  fitId: string | null;
  date: string;
  value: number;
  type: TransactionType;
  description: string;
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
  alreadyImported: boolean;
}

// Entradas sintéticas do BB (saldos parciais) que não são transações reais
const SYNTHETIC_NAMES = new Set(['saldo do dia', 'saldo anterior']);

// Primeira keyword que casar ganha — ordem importa (mais específico primeiro)
const KEYWORD_RULES: Array<[string, string]> = [
  // Cartão de crédito
  ['pagto cartao', 'cartao-credito'],
  ['pagamento cartao', 'cartao-credito'],
  ['fatura cartao', 'cartao-credito'],
  // Taxas bancárias
  ['cobrança de juros', 'taxas'],
  ['juros saldo', 'taxas'],
  ['cobrança de iof', 'taxas'],
  ['iof saldo', 'taxas'],
  ['tarifa bancaria', 'taxas'],
  // Supermercado
  ['supermercado', 'supermercado'],
  ['atacadao', 'supermercado'],
  ['carrefour', 'supermercado'],
  ['assai', 'supermercado'],
  ['pao de acucar', 'supermercado'],
  // Comida e bebida
  ['ifood', 'comida-bebida'],
  ['rappi', 'comida-bebida'],
  ['restaurante', 'comida-bebida'],
  ['lanchonete', 'comida-bebida'],
  ['padaria', 'comida-bebida'],
  // Transporte
  ['uber', 'transporte'],
  ['cabify', 'transporte'],
  ['99app', 'transporte'],
  ['posto', 'transporte'],
  ['gasolina', 'transporte'],
  ['combustivel', 'transporte'],
  // Saúde
  ['farmacia', 'saude'],
  ['drogaria', 'saude'],
  ['hospital', 'saude'],
  ['clinica', 'saude'],
  ['unimed', 'saude'],
  // Assinaturas
  ['netflix', 'assinaturas-digitais'],
  ['spotify', 'assinaturas-digitais'],
  ['disney', 'assinaturas-digitais'],
  ['amazon prime', 'assinaturas-digitais'],
  ['globoplay', 'assinaturas-digitais'],
  ['hbomax', 'assinaturas-digitais'],
  ['deezer', 'assinaturas-digitais'],
  ['apple tv', 'assinaturas-digitais'],
  // Impostos
  ['secretaria da fazenda', 'impostos'],
  ['receita federal', 'impostos'],
  ['iptu', 'impostos'],
  ['ipva', 'impostos'],
  // Salário / receita
  ['salario', 'salario'],
  ['pro-labore', 'salario'],
  ['prolabore', 'salario'],
  // Rendimentos
  ['rendimento', 'rendimentos'],
  ['dividendo', 'rendimentos'],
  // Cashback / reembolso
  ['cashback', 'cashback'],
  ['reembolso', 'cashback'],
  ['estorno', 'cashback'],
  // Saques
  ['saque', 'saques'],
  // Casa
  ['aluguel', 'casa'],
  ['condominio', 'casa'],
  // Educação
  ['escola', 'educacao'],
  ['faculdade', 'educacao'],
  ['mensalidade', 'educacao'],
  // Esportes
  ['academia', 'esportes'],
  // Investimentos
  ['investimento', 'investimento'],
  ['tesouro direto', 'investimento'],
  // Pagamentos online / marketplace
  ['pagseguro', 'compras'],
  ['mercadopago', 'compras'],
  ['paypal', 'compras'],
  ['shopee', 'compras'],
  ['magalu', 'compras'],
  ['americanas', 'compras'],
  // Clubes e benefícios
  ['clube de beneficios', 'assinaturas-digitais'],
  ['clube beneficios', 'assinaturas-digitais'],
  // Taxas adicionais
  ['saldo devedor', 'taxas'],
  ['cobranca iof', 'taxas'],
  ['debito iof', 'taxas'],
];

// Padrão PIX/TED: "DD/MM [HH:MM] Nome" ou "pix/ted Nome"
// Aplicado como fallback após KEYWORD_RULES; usa o type para escolher entre expense/income.
const PIX_TRANSFER_PATTERN =
  /^\d{2}\/\d{2}(?:\s+\d{2}:\d{2})?\s+[a-z][a-z\s.]{2,}$|^(?:pix|ted)\s+[a-z].+/;

// Formatos de data OFX: YYYYMMDDHHMMSS[offset:zone] ou YYYYMMDD
// Retorna YYYY-MM-DD como string, ou null se ano inválido (ex: 0002)
function parseOFXDate(raw: string): string | null {
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  if (year < 1900 || year > 2200) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function extractTag(block: string, name: string): string {
  // Handles both XML (<NAME>value</NAME>) and SGML (<NAME>value\n) — closing tag is optional
  const re = new RegExp(`<${name}>([^<]*)`, 'i');
  const m = block.match(re);
  return m ? m[1].trim() : '';
}

// Detecta e decodifica o buffer respeitando BOM de UTF-16 LE (comum em exports do BB no Windows)
function decodeBuffer(buffer: Buffer): string {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.toString('utf16le').replace(/^﻿/, '');
  }
  const raw = buffer.toString('utf8');
  return raw.startsWith('﻿') ? raw.slice(1) : raw;
}

function parseOFXBody(raw: string): Array<{
  trnType: string; dtPosted: string; trnAmt: string; fitId: string; name: string; memo: string;
}> {
  const body = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Busca case-insensitive para cobrir bancos que exportam <ofx> em minúsculas
  const bodyLower = body.toLowerCase();
  const ofxStart = bodyLower.indexOf('<ofx>');
  if (ofxStart === -1) throw new BadRequestException('Arquivo OFX inválido: nenhum bloco <OFX> encontrado');

  const ofxBody = body.slice(ofxStart);

  // Split on <STMTTRN> handles both OFX 1.x SGML (no closing tags) and OFX 2.x XML.
  // slice(1) discards content before the first <STMTTRN>.
  const stmtBlocks = ofxBody.split(/<STMTTRN>/i).slice(1);
  const result = [];
  for (const block of stmtBlocks) {
    // In XML format, trim at </STMTTRN>; in SGML the entire remaining slice is the block.
    const content = block.replace(/<\/STMTTRN>[\s\S]*/i, '');
    result.push({
      trnType: extractTag(content, 'TRNTYPE'),
      dtPosted: extractTag(content, 'DTPOSTED'),
      trnAmt: extractTag(content, 'TRNAMT'),
      fitId: extractTag(content, 'FITID'),
      name: extractTag(content, 'NAME'),
      memo: extractTag(content, 'MEMO'),
    });
  }
  return result;
}

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

@Injectable()
export class ImportService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(ImportBatch.name) private importBatchModel: Model<ImportBatchDocument>,
    private readonly transactionsService: TransactionsService,
  ) {}

  private async loadCategories(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    return this.categoryModel.find({
      $or: [{ userId: userObjectId }, { userId: null }],
    }).exec();
  }

  private suggestCategory(
    name: string,
    memo: string,
    type: TransactionType,
    categories: CategoryDocument[],
  ): { id: string; name: string } | null {
    const text = normalizeText(`${name} ${memo}`);

    for (const [keyword, slug] of KEYWORD_RULES) {
      if (text.includes(normalizeText(keyword))) {
        const cat = categories.find((c) => c.slug === slug);
        if (cat) return { id: (cat._id as Types.ObjectId).toString(), name: cat.name };
      }
    }

    // Fallback: padrão de transferência PIX/TED por nome de pessoa ou empresa
    if (PIX_TRANSFER_PATTERN.test(text.trim())) {
      const slug = type === TransactionType.INCOME ? 'transferencias-recebidas' : 'transferencias';
      const cat = categories.find((c) => c.slug === slug);
      if (cat) return { id: (cat._id as Types.ObjectId).toString(), name: cat.name };
    }

    return null;
  }

  async preview(userId: string, carteiraId: string, fileBuffer: Buffer): Promise<ImportCandidate[]> {
    const raw = decodeBuffer(fileBuffer);
    const entries = parseOFXBody(raw);
    const categories = await this.loadCategories(userId);
    const result: ImportCandidate[] = [];

    for (const entry of entries) {
      // Filtrar entradas sintéticas do BB
      if (SYNTHETIC_NAMES.has(entry.name.toLowerCase())) continue;

      const date = parseOFXDate(entry.dtPosted);
      if (!date) continue; // data inválida (ex: ano 0002)

      const amount = parseFloat(entry.trnAmt);
      if (isNaN(amount) || amount === 0) continue;

      const type = amount >= 0 ? TransactionType.INCOME : TransactionType.EXPENSE;
      const value = Math.abs(amount);
      const fitId = entry.fitId || null;
      const description = entry.memo || entry.name;

      const suggestion = this.suggestCategory(entry.name, entry.memo, type, categories);

      const alreadyImported =
        fitId !== null
          ? await this.transactionsService.checkFitIdExists(userId, carteiraId, fitId)
          : false;

      result.push({
        fitId,
        date,
        value,
        type,
        description,
        suggestedCategoryId: suggestion?.id ?? null,
        suggestedCategoryName: suggestion?.name ?? null,
        alreadyImported,
      });
    }

    return result;
  }

  async confirm(userId: string, dto: ConfirmImportDto): Promise<{ imported: number; skipped: number; batchId: string | null }> {
    let imported = 0;
    let skipped = 0;
    const createdIds: Types.ObjectId[] = [];

    for (const tx of dto.transactions) {
      if (tx.fitId) {
        const exists = await this.transactionsService.checkFitIdExists(userId, dto.carteiraId, tx.fitId);
        if (exists) { skipped++; continue; }
      }

      const t = await this.transactionsService.create(userId, {
        type: tx.type,
        value: tx.value,
        date: tx.date,
        categoryId: tx.categoryId ?? undefined,
        description: tx.description,
        carteiraId: dto.carteiraId,
        fitId: tx.fitId ?? undefined,
      });
      createdIds.push(t._id as Types.ObjectId);
      imported++;
    }

    if (imported > 0) {
      const batch = await this.importBatchModel.create({
        userId: new Types.ObjectId(userId),
        carteiraId: new Types.ObjectId(dto.carteiraId),
        fileName: dto.fileName ?? undefined,
        transactionCount: imported,
        transactionIds: createdIds,
      });
      return { imported, skipped, batchId: (batch._id as Types.ObjectId).toString() };
    }

    return { imported, skipped, batchId: null };
  }

  async listBatches(userId: string, carteiraId?: string) {
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (carteiraId && Types.ObjectId.isValid(carteiraId)) {
      filter.carteiraId = new Types.ObjectId(carteiraId);
    }
    return this.importBatchModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async deleteBatch(userId: string, batchId: string): Promise<{ removed: number }> {
    if (!Types.ObjectId.isValid(batchId)) throw new BadRequestException('batchId inválido');
    const batch = await this.importBatchModel
      .findOne({ _id: new Types.ObjectId(batchId), userId: new Types.ObjectId(userId) })
      .exec();
    if (!batch) throw new NotFoundException('Lote de importação não encontrado');

    let removed = 0;
    for (const txId of batch.transactionIds) {
      try {
        await this.transactionsService.remove(userId, txId.toString());
        removed++;
      } catch {
        // transaction already deleted manually — conta como faltante
      }
    }

    if (removed < batch.transactionCount) {
      throw new InternalServerErrorException(
        `Undo incompleto: ${removed}/${batch.transactionCount} transações removidas. Lote preservado para diagnóstico.`,
      );
    }

    await batch.deleteOne();
    return { removed };
  }
}
