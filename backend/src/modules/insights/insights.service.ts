import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Transaction, TransactionDocument, TransactionType } from '../transactions/schemas/transaction.schema';
import { PendingAccount, PendingAccountDocument } from '../pending/schemas/pending-account.schema';
import { Goal, GoalDocument } from '../goals/schemas/goal.schema';
import { AnthropicService } from '../../common/services/anthropic.service';
import { GetCashflowDto } from './dto/get-cashflow.dto';

type CashflowGranularity = 'day' | 'week' | 'month';

export interface CashflowPoint {
  date: string;
  income: number;
  expense: number;
}

export interface CashflowResult {
  period: 'month' | 'quarter' | 'year' | 'custom';
  granularity: CashflowGranularity;
  from: string;
  to: string;
  points: CashflowPoint[];
  totals: { income: number; expense: number; balance: number };
}

export interface GoalPace {
  avgMonthlyContribution: number;
  monthsRemaining: number | null;
  requiredMonthlyContribution: number | null;
  onTrack: boolean | null;
}

export interface GoalProgress {
  id: string;
  name: string;
  targetValue: number;
  currentValue: number;
  percentComplete: number;
  deadline: string | null;
  completed: boolean;
  monthlyContributions: { month: string; amount: number }[];
  pace: GoalPace;
}

// Trunca uma data pro início do bucket (dia/semana/mês) em UTC. Semana começa na segunda-feira.
function truncateToBucket(date: Date, granularity: CashflowGranularity): Date {
  if (granularity === 'month') {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

  if (granularity === 'week') {
    const weekday = day.getUTCDay();
    const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
    day.setUTCDate(day.getUTCDate() + diffToMonday);
  }

  return day;
}

function stepBucket(date: Date, granularity: CashflowGranularity): Date {
  const next = new Date(date);
  if (granularity === 'month') next.setUTCMonth(next.getUTCMonth() + 1);
  else if (granularity === 'week') next.setUTCDate(next.getUTCDate() + 7);
  else next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function buildBucketRange(from: Date, to: Date, granularity: CashflowGranularity): Date[] {
  const buckets: Date[] = [];
  let cursor = truncateToBucket(from, granularity);

  while (cursor <= to) {
    buckets.push(new Date(cursor));
    cursor = stepBucket(cursor, granularity);
  }

  return buckets;
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Aproximação simples (meses de 30 dias) — é uma heurística de ritmo, não um cálculo de calendário exato.
function monthsBetween(from: Date, to: Date): number {
  if (to <= from) return 0;
  const days = (to.getTime() - from.getTime()) / 86400000;
  return Math.max(1, Math.ceil(days / 30));
}

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

export interface InsightsOverview {
  topCategoryThisMonth: {
    categoryId: string | null;
    name: string;
    total: number;
    percentOfExpenses: number;
  } | null;
  yoyComparison: {
    year: number;
    previousYear: number;
    currentAvgMonthlyIncome: number;
    currentAvgMonthlyExpense: number;
    currentAvgMonthlyBalance: number;
    previousAvgMonthlyIncome: number;
    previousAvgMonthlyExpense: number;
    previousAvgMonthlyBalance: number;
    incomePct: number | null;
    expensePct: number | null;
    balancePct: number | null;
  };
  monthEndProjection: {
    daysElapsed: number;
    daysInMonth: number;
    actualIncome: number;
    actualExpense: number;
    projectedIncome: number;
    projectedExpense: number;
    projectedBalance: number;
  };
  healthScore: {
    score: number;
    label: 'Excelente' | 'Boa' | 'Atenção' | 'Crítica';
    breakdown: {
      savingsRateSub: number;
      overdueAccountsSub: number;
      spendingTrendSub: number;
    };
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function scoreLabel(score: number): InsightsOverview['healthScore']['label'] {
  if (score >= 80) return 'Excelente';
  if (score >= 60) return 'Boa';
  if (score >= 40) return 'Atenção';
  return 'Crítica';
}

@Injectable()
export class InsightsService {
  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    @InjectModel(PendingAccount.name) private pendingModel: Model<PendingAccountDocument>,
    @InjectModel(Goal.name) private goalModel: Model<GoalDocument>,
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

  // Cards locais/instantâneos (sem custo de API): sempre calculados na hora, sem IA.
  async getOverview(userId: string, year: number): Promise<InsightsOverview> {
    const userObjectId = new Types.ObjectId(userId);
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const monthStart = new Date(Date.UTC(currentYear, currentMonth - 1, 1, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999));
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const daysElapsed = clamp(now.getDate(), 1, daysInMonth);

    // Date.UTC aceita mês negativo e rola pro ano anterior automaticamente (ex: mês 0 = dezembro do ano - 1).
    const prevMonthStart = new Date(Date.UTC(currentYear, currentMonth - 2, 1, 0, 0, 0));
    const prevMonthEnd = new Date(Date.UTC(currentYear, currentMonth - 1, 0, 23, 59, 59, 999));

    const [
      annual,
      categoryRows,
      [monthTotalsFacet],
      overdueCount,
    ] = await Promise.all([
      this.getAnnualAggregates(userId, year),
      this.transactionModel.aggregate([
        {
          $match: {
            userId: userObjectId,
            agendado: { $ne: true },
            type: TransactionType.EXPENSE,
            date: { $gte: monthStart, $lte: monthEnd },
          },
        },
        { $group: { _id: '$categoryId', total: { $sum: '$value' } } },
        { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        { $project: { categoryId: '$_id', name: { $ifNull: ['$category.name', 'Sem categoria'] }, total: 1 } },
        { $sort: { total: -1 } },
      ]),
      this.transactionModel.aggregate([
        {
          $match: {
            userId: userObjectId,
            agendado: { $ne: true },
            type: { $in: [TransactionType.INCOME, TransactionType.EXPENSE] },
            date: { $gte: prevMonthStart, $lte: now },
          },
        },
        {
          $facet: {
            actualThisMonth: [
              { $match: { date: { $gte: monthStart, $lte: now } } },
              { $group: { _id: '$type', total: { $sum: '$value' } } },
            ],
            previousMonthExpense: [
              { $match: { type: TransactionType.EXPENSE, date: { $gte: prevMonthStart, $lte: prevMonthEnd } } },
              { $group: { _id: null, total: { $sum: '$value' } } },
            ],
          },
        },
      ]),
      this.pendingModel.countDocuments({
        userId: userObjectId,
        $or: [{ tipo: 'PAGAR' }, { tipo: { $exists: false } }],
        paid: false,
        skipped: { $ne: true },
        dueDate: { $lt: now },
      }),
    ]);

    // 1. Maior categoria de gasto do mês atual.
    const allCategories = categoryRows as { categoryId: Types.ObjectId | null; name: string; total: number }[];
    const monthTotalExpense = allCategories.reduce((sum, row) => sum + row.total, 0);
    const topRow = allCategories[0];
    const topCategoryThisMonth = topRow
      ? {
          categoryId: topRow.categoryId ? topRow.categoryId.toString() : null,
          name: topRow.name,
          total: topRow.total,
          percentOfExpenses: monthTotalExpense > 0 ? round1((topRow.total / monthTotalExpense) * 100) : 0,
        }
      : null;

    // 2. Comparação ano a ano (reaproveita a mesma agregação anual já usada no resumo com IA).
    const yoyComparison = {
      year: annual.year,
      previousYear: annual.previousYear,
      currentAvgMonthlyIncome: annual.current.avgMonthlyIncome,
      currentAvgMonthlyExpense: annual.current.avgMonthlyExpense,
      currentAvgMonthlyBalance: annual.current.avgMonthlyBalance,
      previousAvgMonthlyIncome: annual.previous.avgMonthlyIncome,
      previousAvgMonthlyExpense: annual.previous.avgMonthlyExpense,
      previousAvgMonthlyBalance: annual.previous.avgMonthlyBalance,
      incomePct: annual.yoyChange.incomePct,
      expensePct: annual.yoyChange.expensePct,
      balancePct: annual.yoyChange.balancePct,
    };

    // 3. Projeção de fim de mês (extrapolação linear pelo ritmo de gasto/ganho até hoje).
    const findMonthTotal = (rows: { _id: TransactionType; total: number }[], type: TransactionType) =>
      rows.find((row) => row._id === type)?.total ?? 0;
    const actualIncome = findMonthTotal(monthTotalsFacet.actualThisMonth, TransactionType.INCOME);
    const actualExpense = findMonthTotal(monthTotalsFacet.actualThisMonth, TransactionType.EXPENSE);
    const projectedIncome = (actualIncome / daysElapsed) * daysInMonth;
    const projectedExpense = (actualExpense / daysElapsed) * daysInMonth;

    const monthEndProjection = {
      daysElapsed,
      daysInMonth,
      actualIncome,
      actualExpense,
      projectedIncome,
      projectedExpense,
      projectedBalance: projectedIncome - projectedExpense,
    };

    // 4. Score de saúde financeira (0-100): 50% taxa de poupança do mês, 25% contas em atraso, 25% tendência de gasto.
    let savingsRateSub: number;
    if (actualIncome > 0) {
      const savingsRate = ((actualIncome - actualExpense) / actualIncome) * 100;
      savingsRateSub = clamp((clamp(savingsRate, -100, 100) + 100) / 2, 0, 100);
    } else {
      savingsRateSub = actualExpense > 0 ? 0 : 50;
    }

    const overdueAccountsSub = clamp(100 - overdueCount * 20, 0, 100);

    const previousMonthExpense = monthTotalsFacet.previousMonthExpense[0]?.total ?? 0;
    const spendingTrendSub =
      previousMonthExpense > 0
        ? clamp(70 - ((projectedExpense - previousMonthExpense) / previousMonthExpense) * 100, 0, 100)
        : 50;

    const score = Math.round(0.5 * savingsRateSub + 0.25 * overdueAccountsSub + 0.25 * spendingTrendSub);

    const healthScore = {
      score: clamp(score, 0, 100),
      label: scoreLabel(score),
      breakdown: {
        savingsRateSub: round1(savingsRateSub),
        overdueAccountsSub: round1(overdueAccountsSub),
        spendingTrendSub: round1(spendingTrendSub),
      },
    };

    return {
      topCategoryThisMonth,
      yoyComparison,
      monthEndProjection,
      healthScore,
    };
  }

  private resolveCashflowRange(dto: GetCashflowDto): { from: Date; to: Date; granularity: CashflowGranularity } {
    const now = new Date();
    const period = dto.period ?? 'year';

    if (period === 'month') {
      const year = dto.year ?? now.getFullYear();
      const month = dto.month ?? now.getMonth() + 1;
      return {
        from: new Date(Date.UTC(year, month - 1, 1)),
        to: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
        granularity: 'day',
      };
    }

    if (period === 'quarter') {
      const year = dto.year ?? now.getFullYear();
      const quarter = dto.quarter ?? Math.floor(now.getMonth() / 3) + 1;
      const startMonth = (quarter - 1) * 3;
      return {
        from: new Date(Date.UTC(year, startMonth, 1)),
        to: new Date(Date.UTC(year, startMonth + 3, 0, 23, 59, 59, 999)),
        granularity: 'week',
      };
    }

    if (period === 'custom') {
      if (!dto.from || !dto.to) {
        throw new BadRequestException('from e to são obrigatórios quando period=custom');
      }

      const from = new Date(`${dto.from}T00:00:00.000Z`);
      const to = new Date(`${dto.to}T23:59:59.999Z`);

      if (from > to) {
        throw new BadRequestException('from deve ser anterior a to');
      }

      const spanDays = (to.getTime() - from.getTime()) / 86400000;
      const granularity: CashflowGranularity = spanDays <= 31 ? 'day' : spanDays <= 120 ? 'week' : 'month';

      return { from, to, granularity };
    }

    // year (default)
    const year = dto.year ?? now.getFullYear();
    return {
      from: new Date(Date.UTC(year, 0, 1)),
      to: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
      granularity: 'month',
    };
  }

  // Entradas e saídas separadas ao longo do tempo. Busca as transações do período e faz o
  // bucketing em JS (não em $group no Mongo) pra reaproveitar a MESMA função de truncamento
  // tanto pros buckets quanto pras datas reais — evita divergência entre o range gerado e o
  // agrupamento (o volume de transações de um único usuário é pequeno o bastante pra isso
  // não pesar, mesmo período a período).
  async getCashflow(userId: string, dto: GetCashflowDto): Promise<CashflowResult> {
    const { from, to, granularity } = this.resolveCashflowRange(dto);
    const userObjectId = new Types.ObjectId(userId);

    const rows = await this.transactionModel
      .find({
        userId: userObjectId,
        agendado: { $ne: true },
        type: { $in: [TransactionType.INCOME, TransactionType.EXPENSE] },
        date: { $gte: from, $lte: to },
      })
      .select('type value date')
      .lean()
      .exec();

    const buckets = buildBucketRange(from, to, granularity);
    const bucketMap = new Map<number, { income: number; expense: number }>();
    for (const bucket of buckets) {
      bucketMap.set(bucket.getTime(), { income: 0, expense: 0 });
    }

    for (const row of rows as unknown as { type: TransactionType; value: number; date: Date }[]) {
      const key = truncateToBucket(new Date(row.date), granularity).getTime();
      const entry = bucketMap.get(key);
      if (!entry) continue;
      if (row.type === TransactionType.INCOME) entry.income += row.value;
      else entry.expense += row.value;
    }

    const points: CashflowPoint[] = buckets.map((bucket) => {
      const entry = bucketMap.get(bucket.getTime())!;
      return { date: bucket.toISOString(), income: entry.income, expense: entry.expense };
    });

    const totals = points.reduce(
      (acc, point) => ({ income: acc.income + point.income, expense: acc.expense + point.expense }),
      { income: 0, expense: 0 },
    );

    return {
      period: dto.period ?? 'year',
      granularity,
      from: from.toISOString(),
      to: to.toISOString(),
      points,
      totals: { income: totals.income, expense: totals.expense, balance: totals.income - totals.expense },
    };
  }

  // Progresso de metas reconstruído a partir do histórico real de contribuições (transações
  // na categoria vinculada à meta), não só um snapshot estático de currentValue/targetValue.
  async getGoalsProgress(userId: string): Promise<GoalProgress[]> {
    const userObjectId = new Types.ObjectId(userId);
    const goals = await this.goalModel.find({ userId: userObjectId }).exec();

    const now = new Date();
    const chartMonths = 12;
    const chartStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (chartMonths - 1), 1));
    const paceMonths = 6;
    const paceStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (paceMonths - 1), 1));

    return Promise.all(
      goals.map(async (goal) => {
        const categoryId = goal.linkedCategoryId;

        const contributions = categoryId
          ? ((await this.transactionModel
              // Só EXPENSE conta como contribuição — mesmo filtro usado por incrementLinkedGoal/
              // decrementLinkedGoal em transactions.service.ts (só gasto na categoria vinculada
              // move o currentValue da meta).
              .find({ userId: userObjectId, categoryId, type: TransactionType.EXPENSE, date: { $gte: chartStart } })
              .select('value date')
              .lean()
              .exec()) as unknown as { value: number; date: Date }[])
          : [];

        const monthlyMap = new Map<string, number>();
        for (let i = 0; i < chartMonths; i++) {
          const bucketDate = new Date(Date.UTC(chartStart.getUTCFullYear(), chartStart.getUTCMonth() + i, 1));
          monthlyMap.set(monthKey(bucketDate), 0);
        }
        for (const contribution of contributions) {
          const key = monthKey(new Date(contribution.date));
          if (monthlyMap.has(key)) {
            monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + contribution.value);
          }
        }

        const monthlyContributions = Array.from(monthlyMap.entries()).map(([month, amount]) => ({ month, amount }));

        const paceContributions = contributions.filter((c) => new Date(c.date) >= paceStart);
        const monthsWithData = new Set(paceContributions.map((c) => monthKey(new Date(c.date)))).size;
        const totalRecent = paceContributions.reduce((sum, c) => sum + c.value, 0);
        const avgMonthlyContribution = monthsWithData > 0 ? totalRecent / monthsWithData : 0;

        let pace: GoalPace;
        if (goal.completed) {
          pace = { avgMonthlyContribution, monthsRemaining: null, requiredMonthlyContribution: null, onTrack: true };
        } else if (goal.deadline) {
          const remainingValue = Math.max(0, goal.targetValue - goal.currentValue);
          const monthsRemaining = monthsBetween(now, goal.deadline);
          const requiredMonthlyContribution = monthsRemaining > 0 ? remainingValue / monthsRemaining : remainingValue;
          pace = {
            avgMonthlyContribution,
            monthsRemaining,
            requiredMonthlyContribution,
            onTrack: avgMonthlyContribution >= requiredMonthlyContribution,
          };
        } else {
          pace = { avgMonthlyContribution, monthsRemaining: null, requiredMonthlyContribution: null, onTrack: null };
        }

        return {
          id: (goal._id as Types.ObjectId).toString(),
          name: goal.name,
          targetValue: goal.targetValue,
          currentValue: goal.currentValue,
          percentComplete: goal.targetValue > 0 ? Math.round((goal.currentValue / goal.targetValue) * 100) : 0,
          deadline: goal.deadline ? goal.deadline.toISOString() : null,
          completed: goal.completed,
          monthlyContributions,
          pace,
        };
      }),
    );
  }
}
