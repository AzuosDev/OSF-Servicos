import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Service, ServiceDocument } from './schemas/service.schema';
import { Appointment, AppointmentDocument } from '../agenda/schemas/appointment.schema';
import { CategoriesService } from '../categories/categories.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

// Verde já usado por "Serviços Prestados" nas categorias padrão — mantém o relatório de
// ganhos consistente quando o usuário não escolhe uma cor na hora de cadastrar o serviço.
const DEFAULT_SERVICE_COLOR = '#22C55E';

// Serviços que todo usuário tem por padrão, sem precisar cadastrar.
// A limpeza de placas não tem preço fixo: o valor sai da faixa por quantidade de placas
// (ver modules/orcamentos/pricing/panel-cleaning-pricing.ts). O defaultValue abaixo é só
// a referência de R$/placa até 10 placas e não é usado no cálculo do orçamento.
const BUILT_IN_SERVICES = [
  {
    name: 'Limpeza de Placas',
    type: 'Limpeza',
    defaultValue: 20,
    color: '#0EA5E9',
    categorySlug: 'servicos-prestados',
  },
] as const;

@Injectable()
export class ServicesService {
  constructor(
    @InjectModel(Service.name) private serviceModel: Model<ServiceDocument>,
    @InjectModel(Appointment.name) private appointmentModel: Model<AppointmentDocument>,
    private categoriesService: CategoriesService,
  ) {}

  async create(userId: string, dto: CreateServiceDto) {
    const userObjectId = new Types.ObjectId(userId);
    const color = dto.color ?? DEFAULT_SERVICE_COLOR;

    let category;
    try {
      category = await this.categoriesService.create(userId, { name: dto.name, color }, true);
    } catch {
      // Nome de categoria já existe para este usuário (ex.: dois serviços com o mesmo nome) — desambigua com sufixo.
      category = await this.categoriesService.create(
        userId,
        { name: `${dto.name} (${Date.now().toString(36)})`, color },
        true,
      );
    }

    return this.serviceModel.create({
      userId: userObjectId,
      name: dto.name,
      type: dto.type,
      defaultValue: dto.defaultValue,
      categoryId: category._id,
      color,
    });
  }

  /**
   * Garante que os serviços padrão existam para o usuário. Idempotente: usa upsert com
   * $setOnInsert, então nunca sobrescreve alterações feitas pelo usuário (preço, cor,
   * desativação). Roda na listagem para cobrir também contas criadas antes deste recurso.
   */
  async ensureBuiltInServices(userId: string) {
    const userObjectId = new Types.ObjectId(userId);

    for (const builtIn of BUILT_IN_SERVICES) {
      const category = await this.categoriesService.findDefaultBySlug(builtIn.categorySlug);
      if (!category) {
        continue;
      }

      await this.serviceModel
        .findOneAndUpdate(
          { userId: userObjectId, name: builtIn.name },
          {
            $setOnInsert: {
              userId: userObjectId,
              name: builtIn.name,
              type: builtIn.type,
              defaultValue: builtIn.defaultValue,
              color: builtIn.color,
              categoryId: category._id,
              active: true,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        )
        .exec();
    }
  }

  async findAll(userId: string, activeOnly = false) {
    await this.ensureBuiltInServices(userId);

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
    if (typeof dto.color !== 'undefined') {
      service.color = dto.color;
      await this.categoriesService.updateColor(userId, service.categoryId.toString(), dto.color);
    }
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
