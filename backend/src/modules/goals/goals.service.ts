import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Goal, GoalDocument } from './schemas/goal.schema';
import { Category, CategoryDocument } from '../categories/schemas/category.schema';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';

@Injectable()
export class GoalsService {
  constructor(
    @InjectModel(Goal.name) private goalModel: Model<GoalDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
  ) {}

  private generateSlug(name: string) {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private async findOrCreateLinkedCategory(userId: Types.ObjectId, name: string): Promise<Types.ObjectId> {
    const slug = this.generateSlug(name);
    const existing = await this.categoryModel.findOne({ slug, userId }).exec();
    if (existing) {
      return existing._id as Types.ObjectId;
    }
    const created = await this.categoryModel.create({ userId, name, slug, isDefault: false });
    return created._id as Types.ObjectId;
  }

  async create(userId: string, dto: CreateGoalDto) {
    const userObjectId = new Types.ObjectId(userId);
    const currentValue = dto.currentValue ?? 0;
    const completed = currentValue >= dto.targetValue;
    const linkedCategoryId = await this.findOrCreateLinkedCategory(userObjectId, dto.name);

    return this.goalModel.create({
      userId: userObjectId,
      name: dto.name,
      targetValue: dto.targetValue,
      currentValue,
      deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      completed,
      linkedCategoryId,
    });
  }

  async findAll(userId: string) {
    const goals = await this.goalModel.find({ userId: new Types.ObjectId(userId) }).exec();
    return goals.map((goal) => ({
      ...goal.toObject(),
      percentComplete: goal.targetValue > 0 ? Math.round((goal.currentValue / goal.targetValue) * 100) : 0,
    }));
  }

  async update(userId: string, id: string, dto: UpdateGoalDto) {
    const goal = await this.goalModel.findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) }).exec();
    if (!goal) {
      throw new NotFoundException('Goal not found');
    }

    if (typeof dto.name !== 'undefined') goal.name = dto.name;
    if (typeof dto.targetValue !== 'undefined') goal.targetValue = dto.targetValue;
    if (typeof dto.currentValue !== 'undefined') goal.currentValue = dto.currentValue;
    if (typeof dto.deadline !== 'undefined') goal.deadline = dto.deadline ? new Date(dto.deadline) : undefined;

    if (goal.currentValue >= goal.targetValue) {
      goal.completed = true;
    }

    await goal.save();

    return {
      ...goal.toObject(),
      percentComplete: goal.targetValue > 0 ? Math.round((goal.currentValue / goal.targetValue) * 100) : 0,
    };
  }

  async remove(userId: string, id: string) {
    const result = await this.goalModel.findOneAndDelete({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) }).exec();
    if (!result) {
      throw new NotFoundException('Goal not found');
    }
    return { deleted: true };
  }
}
