import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Transaction, TransactionDocument, TransactionType } from '../transactions/schemas/transaction.schema';
import { AnthropicService } from '../../common/services/anthropic.service';

export interface PeriodTotals {
  totalIncome: number;
  totalExpense: number;
  monthsWithData: number;
  avgMonthlyIncome: number;
  avgMonthlyExpense: number;
  avgMonthlyBalance: number;
}

export interface TopCategory {
  categoryId: string | null;
  name: string;
  total: number;
  percentOfExpenses: number;
  yoyPct: number | null;
}

export interface AnnualAggregates {
  year: number;
  previousYear: number;
  current: PeriodTotals;
  previous: PeriodTotals;
  yoyChange: {
    incomePct: number | null;
    expensePct: number | null;
    balancePct: number | null;
  };
  topCategories: TopCategory[];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// Base em módulo para não gerar sinal invertido quando o período anterior é negativo (saldo médio).
function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return null;
  }

  return round1(((current - previous) / Math.abs(previous)) * 100);
}

function buildPeriodTotals(totalIncome: number, totalExpense: number, monthsWithData: number): PeriodTotals {
  const avgMonthlyIncome = monthsWithData > 0 ? totalIncome / monthsWithData : 0;
  const avgMonthlyExpense = monthsWithData > 0 ? totalExpense / monthsWithData : 0;

  return {
    totalIncome,
    totalExpense,
    monthsWithData,
    avgMonthlyIncome,
    avgMonthlyExpense,
    avgMonthlyBalance: avgMonthlyIncome - avgMonthlyExpense,
  };
}

@Injectable()
export class InsightsService {
  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    private anthropicService: AnthropicService,
  ) {}

  async getAnnualAggregates(userId: string, year: number): Promise<AnnualAggregates> {
    const previousYear = year - 1;
    const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    const prevStart = new Date(Date.UTC(previousYear, 0, 1, 0, 0, 0));
    const prevEnd = new Date(Date.UTC(previousYear, 11, 31, 23, 59, 59, 999));
    const userObjectId = new Types.ObjectId(userId);

    const [facetResult] = await this.transactionModel.aggregate([
      {
        $match: {
          userId: userObjectId,
          agendado: { $ne: true },
          type: { $in: [TransactionType.INCOME, TransactionType.EXPENSE] },
          date: { $gte: prevStart, $lte: yearEnd },
        },
      },
      {
        $facet: {
          currentTotals: [
            { $match: { date: { $gte: yearStart, $lte: yearEnd } } },
            { $group: { _id: '$type', total: { $sum: '$value' } } },
          ],
          previousTotals: [
            { $match: { date: { $gte: prevStart, $lte: prevEnd } } },
            { $group: { _id: '$type', total: { $sum: '$value' } } },
          ],
          currentMonthsWithData: [
            { $match: { date: { $gte: yearStart, $lte: yearEnd } } },
            { $group: { _id: { $month: '$date' } } },
            { $count: 'count' },
          ],
          previousMonthsWithData: [
            { $match: { date: { $gte: prevStart, $lte: prevEnd } } },
            { $group: { _id: { $month: '$date' } } },
            { $count: 'count' },
          ],
          currentByCategory: [
            { $match: { type: TransactionType.EXPENSE, date: { $gte: yearStart, $lte: yearEnd } } },
            { $group: { _id: '$categoryId', total: { $sum: '$value' } } },
            { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
            { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                categoryId: '$_id',
                name: { $ifNull: ['$category.name', 'Sem categoria'] },
                total: 1,
              },
            },
            { $sort: { total: -1 } },
            { $limit: 3 },
          ],
          previousByCategory: [
            { $match: { type: TransactionType.EXPENSE, date: { $gte: prevStart, $lte: prevEnd } } },
            { $group: { _id: '$categoryId', total: { $sum: '$value' } } },
          ],
        },
      },
    ]);

    const findTotal = (rows: { _id: TransactionType; total: number }[], type: TransactionType) =>
      rows.find((row) => row._id === type)?.total ?? 0;

    const current = buildPeriodTotals(
      findTotal(facetResult.currentTotals, TransactionType.INCOME),
      findTotal(facetResult.currentTotals, TransactionType.EXPENSE),
      facetResult.currentMonthsWithData[0]?.count ?? 0,
    );
    const previous = buildPeriodTotals(
      findTotal(facetResult.previousTotals, TransactionType.INCOME),
      findTotal(facetResult.previousTotals, TransactionType.EXPENSE),
      facetResult.previousMonthsWithData[0]?.count ?? 0,
    );

    const previousByCategoryMap = new Map<string, number>(
      (facetResult.previousByCategory as { _id: Types.ObjectId | null; total: number }[]).map((row) => [
        String(row._id ?? 'none'),
        row.total,
      ]),
    );

    const topCategories: TopCategory[] = (
      facetResult.currentByCategory as { categoryId: Types.ObjectId | null; name: string; total: number }[]
    ).map((row) => {
      const key = String(row.categoryId ?? 'none');
      const previousTotal = previousByCategoryMap.get(key) ?? 0;

      return {
        categoryId: row.categoryId ? row.categoryId.toString() : null,
        name: row.name,
        total: row.total,
        percentOfExpenses: current.totalExpense > 0 ? round1((row.total / current.totalExpense) * 100) : 0,
        yoyPct: percentChange(row.total, previousTotal),
      };
    });

    return {
      year,
      previousYear,
      current,
      previous,
      yoyChange: {
        incomePct: percentChange(current.avgMonthlyIncome, previous.avgMonthlyIncome),
        expensePct: percentChange(current.avgMonthlyExpense, previous.avgMonthlyExpense),
        balancePct: percentChange(current.avgMonthlyBalance, previous.avgMonthlyBalance),
      },
      topCategories,
    };
  }

  async getAnnualSummary(userId: string, year: number) {
    const aggregates = await this.getAnnualAggregates(userId, year);

    // Sem transações no ano selecionado: evita gastar uma chamada à IA à toa.
    if (aggregates.current.monthsWithData === 0) {
      return { ...aggregates, narrative: null, narrativeUnavailable: false, noData: true };
    }

    const narrative = await this.anthropicService.narrateFinancialSummary(aggregates);

    return {
      ...aggregates,
      narrative,
      narrativeUnavailable: narrative === null,
      noData: false,
    };
  }
}
