import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Transaction, TransactionDocument, TransactionType } from '../transactions/schemas/transaction.schema';
import { PendingAccount, PendingAccountDocument } from '../pending/schemas/pending-account.schema';
import { Goal, GoalDocument } from '../goals/schemas/goal.schema';
import { GetDashboardDto } from './dto/get-dashboard.dto';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    @InjectModel(PendingAccount.name) private pendingModel: Model<PendingAccountDocument>,
    @InjectModel(Goal.name) private goalModel: Model<GoalDocument>,
  ) {}

  async getDashboard(userId: string, query: GetDashboardDto) {
    const now = new Date();
    const month = query.month ?? now.getMonth() + 1;
    const year = query.year ?? now.getFullYear();
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    const userObjectId = new Types.ObjectId(userId);

    // All 5 transaction queries consolidated into a single $facet round-trip.
    // Pending and goals run in parallel with it via Promise.all.
    const [facetResult, pendingAccounts, goals] = await Promise.all([
      this.transactionModel
        .aggregate([
          { $match: { userId: userObjectId, date: { $gte: yearStart, $lte: yearEnd } } },
          {
            $facet: {
              totalIncome: [
                { $match: { type: TransactionType.INCOME, date: { $gte: startDate, $lte: endDate } } },
                { $group: { _id: null, total: { $sum: '$value' } } },
              ],
              totalExpenses: [
                { $match: { type: TransactionType.EXPENSE, date: { $gte: startDate, $lte: endDate } } },
                { $group: { _id: null, total: { $sum: '$value' } } },
              ],
              expensesByCategory: [
                { $match: { type: TransactionType.EXPENSE, date: { $gte: startDate, $lte: endDate } } },
                { $group: { _id: '$categoryId', total: { $sum: '$value' } } },
                {
                  $lookup: {
                    from: 'categories',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'category',
                  },
                },
                { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
                {
                  $project: {
                    categoryId: '$_id',
                    categoryName: { $ifNull: ['$category.name', 'Sem categoria'] },
                    categoryColor: { $ifNull: ['$category.color', '#6B7280'] },
                    categoryIcon: { $ifNull: ['$category.icon', 'Receipt'] },
                    total: 1,
                  },
                },
                { $sort: { total: -1 } },
              ],
              monthlyAggregation: [
                {
                  $group: {
                    _id: { month: { $month: '$date' }, type: '$type' },
                    total: { $sum: '$value' },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    month: '$_id.month',
                    type: '$_id.type',
                    total: 1,
                  },
                },
              ],
              recentTransactions: [
                { $match: { date: { $gte: startDate, $lte: endDate } } },
                { $sort: { date: -1 } },
                { $limit: 5 },
                {
                  $lookup: {
                    from: 'categories',
                    localField: 'categoryId',
                    foreignField: '_id',
                    as: 'category',
                  },
                },
                { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
                {
                  $project: {
                    id: '$_id',
                    type: 1,
                    value: 1,
                    date: 1,
                    description: 1,
                    categoryName: '$category.name',
                    categoryColor: '$category.color',
                  },
                },
              ],
            },
          },
        ])
        .exec(),
      this.pendingModel
        .find({
          userId: userObjectId,
          paid: false,
          skipped: { $ne: true },
          isRecorrente: { $ne: true },
          dueDate: { $lte: endDate },
        })
        .sort({ dueDate: 1 })
        .exec(),
      this.goalModel.find({ userId: userObjectId }).exec(),
    ]);

    const facet = facetResult[0];

    const totalIncome = facet.totalIncome[0]?.total ?? 0;
    const totalExpenses = facet.totalExpenses[0]?.total ?? 0;
    const balance = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? parseFloat(((balance / totalIncome) * 100).toFixed(1)) : 0;

    const monthlyEvolution = Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      income: 0,
      expenses: 0,
    }));

    for (const item of facet.monthlyAggregation) {
      const monthIndex = item.month - 1;
      if (monthIndex >= 0 && monthIndex < 12) {
        if (item.type === TransactionType.INCOME) {
          monthlyEvolution[monthIndex].income = item.total;
        } else if (item.type === TransactionType.EXPENSE) {
          monthlyEvolution[monthIndex].expenses = item.total;
        }
      }
    }

    const totalPending = pendingAccounts.reduce((sum, item) => sum + item.value, 0);

    const goalsSummary = goals.map((goal) => ({
      ...goal.toObject(),
      percentComplete: goal.targetValue > 0 ? Math.round((goal.currentValue / goal.targetValue) * 100) : 0,
    }));

    return {
      month,
      year,
      totalIncome,
      totalExpense: totalExpenses,
      totalExpenses,
      balance,
      savingsRate,
      expensesByCategory: facet.expensesByCategory,
      monthlyEvolution,
      recentTransactions: facet.recentTransactions,
      pendingAccounts: {
        items: pendingAccounts,
        totalPending,
      },
      goalsSummary,
    };
  }
}
