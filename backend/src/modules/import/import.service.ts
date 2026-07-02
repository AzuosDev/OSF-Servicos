import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category, CategoryDocument } from '../categories/schemas/category.schema';
import { TransactionsService } from '../transactions/transactions.service';
import { TransactionType } from '../transactions/schemas/transaction.schema';
import { ConfirmImportDto } from './dto/confirm-import.dto';

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
];

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
  const re = new RegExp(`<${name}>([^<]*)<\\/${name}>`, 'i');
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
  const trnRe = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  const result = [];
  let match: RegExpExecArray | null;
  while ((match = trnRe.exec(ofxBody)) !== null) {
    const block = match[1];
    result.push({
      trnType: extractTag(block, 'TRNTYPE'),
      dtPosted: extractTag(block, 'DTPOSTED'),
      trnAmt: extractTag(block, 'TRNAMT'),
      fitId: extractTag(block, 'FITID'),
      name: extractTag(block, 'NAME'),
      memo: extractTag(block, 'MEMO'),
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

  async confirm(userId: string, dto: ConfirmImportDto): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    for (const tx of dto.transactions) {
      // Deduplicação por fitId
      if (tx.fitId) {
        const exists = await this.transactionsService.checkFitIdExists(userId, dto.carteiraId, tx.fitId);
        if (exists) {
          skipped++;
          continue;
        }
      }

      await this.transactionsService.create(userId, {
        type: tx.type,
        value: tx.value,
        date: tx.date,
        categoryId: tx.categoryId ?? undefined,
        description: tx.description,
        carteiraId: dto.carteiraId,
        fitId: tx.fitId ?? undefined,
      });

      imported++;
    }

    return { imported, skipped };
  }
}
