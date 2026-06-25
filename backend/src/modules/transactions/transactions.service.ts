import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Transaction, TransactionDocument, TransactionType } from './schemas/transaction.schema';
import { Category, CategoryDocument } from '../categories/schemas/category.schema';
import { Goal, GoalDocument } from '../goals/schemas/goal.schema';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(Goal.name) private goalModel: Model<GoalDocument>,
  ) {}

  private toObjectId(value: string, fieldName: string) {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`${fieldName} must be a valid ObjectId`);
    }
    return new Types.ObjectId(value);
  }

  async create(userId: string, dto: CreateTransactionDto) {
    if (dto.type === TransactionType.EXPENSE && !dto.categoryId) {
      throw new BadRequestException('categoryId is required for expense transactions');
    }

    const userObjectId = this.toObjectId(userId, 'userId');
    let categoryObjectId: Types.ObjectId | undefined;

    if (dto.categoryId) {
      categoryObjectId = this.toObjectId(dto.categoryId, 'categoryId');
      const valid = await this.categoryModel.findOne({
        _id: categoryObjectId,
        $or: [{ userId: null }, { userId: userObjectId }],
      }).exec();
      if (!valid) {
        throw new BadRequestException('Invalid category for this user');
      }
    }

    const transaction = await this.transactionModel.create({
      userId: userObjectId,
      type: dto.type,
      value: dto.value,
      categoryId: categoryObjectId,
      description: dto.description,
      date: new Date(dto.date),
    });

    if (dto.type === TransactionType.EXPENSE && categoryObjectId) {
      await this.incrementLinkedGoal(userObjectId, categoryObjectId, dto.value);
    }

    return transaction;
  }

  private async incrementLinkedGoal(userId: Types.ObjectId, categoryId: Types.ObjectId, amount: number) {
    const goal = await this.goalModel.findOne({ userId, linkedCategoryId: categoryId }).exec();
    if (!goal) return;
    goal.currentValue = Math.max(0, goal.currentValue + amount);
    goal.completed = goal.currentValue >= goal.targetValue;
    await goal.save();
  }

  private async decrementLinkedGoal(userId: Types.ObjectId, categoryId: Types.ObjectId, amount: number) {
    const goal = await this.goalModel.findOne({ userId, linkedCategoryId: categoryId }).exec();
    if (!goal) return;
    goal.currentValue = Math.max(0, goal.currentValue - amount);
    goal.completed = goal.currentValue >= goal.targetValue;
    await goal.save();
  }

  async findAll(
    userId: string,
    type?: TransactionType,
    page = 1,
    limit = 10,
    categoryId?: string,
    month?: number,
    year?: number,
  ) {
    const filter: FilterQuery<TransactionDocument> = { userId: new Types.ObjectId(userId) };
    if (type) {
      filter.type = type;
    }

    if (categoryId) {
      filter.categoryId = this.toObjectId(categoryId, 'categoryId');
    }

    if (month && year) {
      const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
      const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
      filter.date = { $gte: startDate, $lte: endDate };
    }

    const [data, total] = await Promise.all([
      this.transactionModel.find(filter).sort({ date: -1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.transactionModel.countDocuments(filter).exec(),
    ]);

    return { data, total, page, limit };
  }

  async findOne(userId: string, id: string) {
    const transaction = await this.transactionModel.findOne({
      _id: this.toObjectId(id, 'id'),
      userId: this.toObjectId(userId, 'userId'),
    }).exec();
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return transaction;
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto) {
    const transaction = await this.transactionModel.findOne({
      _id: this.toObjectId(id, 'id'),
      userId: this.toObjectId(userId, 'userId'),
    }).exec();
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (dto.type) transaction.type = dto.type;
    if (typeof dto.value !== 'undefined') transaction.value = dto.value;
    if (dto.categoryId) transaction.categoryId = this.toObjectId(dto.categoryId, 'categoryId');
    if (typeof dto.description !== 'undefined') transaction.description = dto.description;
    if (dto.date) transaction.date = new Date(dto.date);

    await transaction.save();
    return transaction;
  }

  async remove(userId: string, id: string) {
    const userObjectId = this.toObjectId(userId, 'userId');
    const transaction = await this.transactionModel.findOne({
      _id: this.toObjectId(id, 'id'),
      userId: userObjectId,
    }).exec();
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    await transaction.deleteOne();

    if (transaction.type === TransactionType.EXPENSE && transaction.categoryId) {
      await this.decrementLinkedGoal(userObjectId, transaction.categoryId as Types.ObjectId, transaction.value);
    }

    return { deleted: true };
  }
}
