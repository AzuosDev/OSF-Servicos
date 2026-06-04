import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Transaction, TransactionDocument, TransactionType } from '../transactions/schemas/transaction.schema';
import { Category, CategoryDocument } from '../categories/schemas/category.schema';
import { PendingAccount, PendingAccountDocument } from '../pending/schemas/pending-account.schema';
import { Goal, GoalDocument } from '../goals/schemas/goal.schema';
import { GetDashboardDto } from './dto/get-dashboard.dto';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
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

    const totalIncomeResult = await this.transactionModel
      .aggregate([
        { $match: { userId: userObjectId, type: TransactionType.INCOME, date: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, total: { $sum: '$value' } } },
      ])
      .exec();

    const totalExpensesResult = await this.transactionModel
      .aggregate([
        { $match: { userId: userObjectId, type: TransactionType.EXPENSE, date: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, total: { $sum: '$value' } } },
      ])
      .exec();

    const totalIncome = totalIncomeResult[0]?.total ?? 0;
    const totalExpenses = totalExpensesResult[0]?.total ?? 0;
    const balance = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? parseFloat(((balance / totalIncome) * 100).toFixed(1)) : 0;

    const expensesByCategory = await this.transactionModel
      .aggregate([
        { $match: { userId: userObjectId, type: TransactionType.EXPENSE, date: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: '$categoryId', total: { $sum: '$value' } } },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'category',
          },
        },
        { $unwind: '$category' },
        {
          $project: {
            categoryId: '$_id',
            categoryName: '$category.name',
            categoryColor: '$category.color',
            categoryIcon: '$category.icon',
            total: 1,
          },
        },
        { $sort: { total: -1 } },
      ])
      .exec();

    const monthlyAggregation = await this.transactionModel
      .aggregate([
        { $match: { userId: userObjectId, date: { $gte: yearStart, $lte: yearEnd } } },
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
      ])
      .exec();

    const monthlyEvolution = Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      income: 0,
      expenses: 0,
    }));

    for (const item of monthlyAggregation) {
      const monthIndex = item.month - 1;
      if (monthIndex >= 0 && monthIndex < 12) {
        if (item.type === TransactionType.INCOME) {
          monthlyEvolution[monthIndex].income = item.total;
        } else if (item.type === TransactionType.EXPENSE) {
          monthlyEvolution[monthIndex].expenses = item.total;
        }
      }
    }

    const pendingAccounts = await this.pendingModel
      .find({ userId: userObjectId, paid: false, dueDate: { $lte: endDate } })
      .sort({ dueDate: 1 })
      .exec();

    const totalPending = pendingAccounts.reduce((sum, item) => sum + item.value, 0);

    const goals = await this.goalModel.find({ userId: userObjectId }).exec();
    const goalsSummary = goals.map((goal) => ({
      ...goal.toObject(),
      percentComplete: goal.targetValue > 0 ? Math.round((goal.currentValue / goal.targetValue) * 100) : 0,
    }));

    const recentTransactions = await this.transactionModel
      .aggregate([
        { $match: { userId: userObjectId, date: { $gte: startDate, $lte: endDate } } },
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
      ])
      .exec();

    return {
      month,
      year,
      totalIncome,
      totalExpense: totalExpenses,
      totalExpenses,
      balance,
      savingsRate,
      expensesByCategory,
      monthlyEvolution,
      recentTransactions,
      pendingAccounts: {
        items: pendingAccounts,
        totalPending,
      },
      goalsSummary,
    };
  }
}
