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
    if (dto.isParcelada) {
      if (!dto.parcelas) {
        throw new BadRequestException('Parcelas sao obrigatorias quando isParcelada = true');
      }
      const { totalParcelas } = dto.parcelas;
      if (totalParcelas <= 0) {
        throw new BadRequestException('totalParcelas deve ser maior que zero');
      }
      dto.parcelas.valorParcela = Number((dto.value / totalParcelas).toFixed(2));
      dto.parcelas.parcelasPagas = Number(dto.parcelas.parcelasPagas ?? 0);
    }

    if (dto.isRecorrente && !dto.recorrencia) {
      throw new BadRequestException('Recorrencia e obrigatoria quando isRecorrente = true');
    }

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
      parcelas: dto.parcelas ? { ...dto.parcelas, parcelasPagas: 0 } : undefined,
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
    if (typeof dto.numeroParcela !== 'undefined' && !pending.isParcelada) {
      throw new BadRequestException('numeroParcela so e valido para contas parceladas');
    }

    if (typeof dto.paid !== 'undefined') {
      if (dto.paid && pending.isParcelada && typeof dto.numeroParcela === 'number') {
        if (!pending.parcelas) {
          throw new BadRequestException('Parcelas inexistentes');
        }
        pending.parcelas.parcelasPagas = Math.min((pending.parcelas.parcelasPagas ?? 0) + 1, pending.parcelas.totalParcelas);
        pending.paid = pending.parcelas.parcelasPagas >= pending.parcelas.totalParcelas;
        if (pending.paid) {
          pending.paidAt = pending.paidAt ?? new Date();
        }
      } else {
        pending.paid = dto.paid;
        if (dto.paid) {
          pending.paidAt = pending.paidAt ?? new Date();
        }
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
