import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CompanySettings, CompanySettingsDocument } from './schemas/company-settings.schema';
import { CompanySettingsDto } from './dto/company-settings.dto';

@Injectable()
export class CompanySettingsService {
  constructor(
    @InjectModel(CompanySettings.name) private companySettingsModel: Model<CompanySettingsDocument>,
  ) {}

  async get(userId: string) {
    const settings = await this.companySettingsModel.findOne({ userId: new Types.ObjectId(userId) }).exec();
    if (!settings) {
      throw new NotFoundException('Configure os dados da empresa antes de criar orçamentos');
    }
    return settings;
  }

  async findRaw(userId: string) {
    return this.companySettingsModel.findOne({ userId: new Types.ObjectId(userId) }).exec();
  }

  async upsert(userId: string, dto: CompanySettingsDto) {
    return this.companySettingsModel
      .findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $set: dto, $setOnInsert: { userId: new Types.ObjectId(userId) } },
        { upsert: true, new: true, runValidators: true },
      )
      .exec();
  }
}
