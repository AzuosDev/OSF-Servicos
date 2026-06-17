import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PendingAccount, PendingAccountDocument } from './schemas/pending-account.schema';
import { CreatePendingDto } from './dto/create-pending.dto';
import { UpdatePendingDto } from './dto/update-pending.dto';

@Injectable()
export class PendingService {
  constructor(@InjectModel(PendingAccount.name) private pendingModel: Model<PendingAccountDocument>) {}

  async create(userId: string, dto: CreatePendingDto) {
    // validações condicionais para novos campos
    if (dto.isParcelada) {
      if (!dto.parcelas) {
        throw new BadRequestException('Parcelas são obrigatórias quando isParcelada = true');
      }
      const { totalParcelas, dataInicio, dataFim } = dto.parcelas;
      if (totalParcelas <= 0) {
        throw new BadRequestException('totalParcelas deve ser maior que zero');
      }
      // calcula valor da parcela
      dto.parcelas.valorParcela = Number((dto.value / totalParcelas).toFixed(2));
    }
    if (dto.isRecorrente) {
      if (!dto.recorrencia) {
        throw new BadRequestException('Recorrência é obrigatória quando isRecorrente = true');
      }
    }
    // cria documento com todos os campos
    const created = new this.pendingModel({
      userId: new Types.ObjectId(userId),
      title: dto.title,
      value: dto.value,
      dueDate: new Date(dto.dueDate),
      description: dto.description,
      paid: false,
      isParcelada: dto.isParcelada,
      isRecorrente: dto.isRecorrente,
      categoria: dto.categoria,
      formatoPagamento: dto.formatoPagamento,
      parcelas: dto.parcelas,
      recorrencia: dto.recorrencia,
    });
    return created.save();
  }

  async findAll(userId: string, paid?: boolean) {
    const filter: any = { userId: new Types.ObjectId(userId) };
    if (typeof paid === 'boolean') {
      filter.paid = paid;
    }
    return this.pendingModel.find(filter).sort({ dueDate: 1 }).exec();
  }

  async update(userId: string, id: string, dto: UpdatePendingDto) {
    const pending = await this.pendingModel.findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) }).exec();
    if (!pending) {
      throw new NotFoundException('Pending account not found');
    }

    if (typeof dto.title !== 'undefined') pending.title = dto.title;
    if (typeof dto.value !== 'undefined') pending.value = dto.value;
    if (typeof dto.dueDate !== 'undefined') pending.dueDate = new Date(dto.dueDate);
    if (typeof dto.description !== 'undefined') pending.description = dto.description;
    if (typeof dto.paid !== 'undefined') {
      pending.paid = dto.paid;
      if (dto.paid) {
        pending.paidAt = pending.paidAt ?? new Date();
      }
    }

    await pending.save();
    return pending;
  }

  async remove(userId: string, id: string) {
    const result = await this.pendingModel.findOneAndDelete({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) }).exec();
    if (!result) {
      throw new NotFoundException('Pending account not found');
    }
    return { deleted: true };
  }
}
