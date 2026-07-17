import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Service, ServiceDocument } from './schemas/service.schema';
import { Appointment, AppointmentDocument } from '../agenda/schemas/appointment.schema';
import { CategoriesService } from '../categories/categories.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(
    @InjectModel(Service.name) private serviceModel: Model<ServiceDocument>,
    @InjectModel(Appointment.name) private appointmentModel: Model<AppointmentDocument>,
    private categoriesService: CategoriesService,
  ) {}

  async create(userId: string, dto: CreateServiceDto) {
    const userObjectId = new Types.ObjectId(userId);

    let category;
    try {
      category = await this.categoriesService.create(userId, { name: dto.name }, true);
    } catch {
      // Nome de categoria já existe para este usuário (ex.: dois serviços com o mesmo nome) — desambigua com sufixo.
      category = await this.categoriesService.create(
        userId,
        { name: `${dto.name} (${Date.now().toString(36)})` },
        true,
      );
    }

    return this.serviceModel.create({
      userId: userObjectId,
      name: dto.name,
      type: dto.type,
      defaultValue: dto.defaultValue,
      categoryId: category._id,
    });
  }

  async findAll(userId: string, activeOnly = false) {
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (activeOnly) {
      filter.active = true;
    }
    return this.serviceModel.find(filter).sort({ name: 1 }).exec();
  }

  async findOne(userId: string, id: string) {
    const service = await this.serviceModel
      .findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) })
      .exec();
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    return service;
  }

  async update(userId: string, id: string, dto: UpdateServiceDto) {
    const service = await this.findOne(userId, id);
    if (typeof dto.name !== 'undefined') service.name = dto.name;
    if (typeof dto.type !== 'undefined') service.type = dto.type;
    if (typeof dto.defaultValue !== 'undefined') service.defaultValue = dto.defaultValue;
    if (typeof dto.active !== 'undefined') service.active = dto.active;
    await service.save();
    return service;
  }

  async remove(userId: string, id: string) {
    const service = await this.findOne(userId, id);
    const hasAppointments = await this.appointmentModel.exists({ serviceId: service._id });
    if (hasAppointments) {
      throw new BadRequestException(
        'Não é possível excluir um serviço com agendamentos vinculados. Desative-o em vez de excluir.',
      );
    }
    await service.deleteOne();
    return { deleted: true };
  }
}
