import { Injectable, OnModuleInit, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category, CategoryDocument } from './schemas/category.schema';
import { DEFAULT_CATEGORIES } from './data/default-categories';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService implements OnModuleInit {
  constructor(@InjectModel(Category.name) private categoryModel: Model<CategoryDocument>) {}

  async onModuleInit() {
    for (const cat of DEFAULT_CATEGORIES) {
      await this.categoryModel
        .updateOne(
          { slug: cat.slug, isDefault: true },
          { $setOnInsert: cat },
          { upsert: true },
        )
        .exec();
    }
  }

  async findAll(userId: string, income?: boolean) {
    const userFilter = { $or: [{ userId: null }, { userId: new Types.ObjectId(userId) }] };
    const incomeFilter = income === true ? { isIncome: true } : { isIncome: { $ne: true } };
    return this.categoryModel
      .find({ ...userFilter, ...incomeFilter })
      .sort({ name: 1 })
      .exec();
  }

  async create(userId: string, dto: CreateCategoryDto, isIncome = false) {
    const slug = this.generateSlug(dto.name);
    const exists = await this.categoryModel.findOne({ slug, userId: new Types.ObjectId(userId) }).exec();
    if (exists) {
      throw new BadRequestException('Category slug already exists for this user');
    }
    return this.categoryModel.create({
      userId: new Types.ObjectId(userId),
      name: dto.name,
      slug,
      icon: dto.icon,
      color: dto.color,
      isDefault: false,
      isIncome,
    });
  }

  async findById(id: string) {
    return this.categoryModel.findById(id).exec();
  }

  async findDefaultBySlug(slug: string) {
    return this.categoryModel.findOne({ slug, isDefault: true }).exec();
  }

  async updateColor(userId: string, categoryId: string, color: string) {
    await this.categoryModel
      .updateOne({ _id: new Types.ObjectId(categoryId), userId: new Types.ObjectId(userId) }, { $set: { color } })
      .exec();
  }

  async belongsToUserOrDefault(id: string, userId: string) {
    const category = await this.categoryModel.findById(id).exec();
    if (!category) return false;
    if (!category.userId) return true;
    return category.userId.toString() === userId;
  }

  async remove(userId: string, id: string) {
    const category = await this.categoryModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
      isDefault: false,
    }).exec();

    if (!category) {
      throw new NotFoundException('Category not found or cannot be deleted');
    }

    await category.deleteOne();
    return { deleted: true };
  }

  private generateSlug(name: string) {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}
