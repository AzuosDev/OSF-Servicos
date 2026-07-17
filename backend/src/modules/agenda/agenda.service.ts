import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Appointment,
  AppointmentDocument,
  AppointmentStatus,
  PaymentStatus,
} from './schemas/appointment.schema';
import { Service, ServiceDocument } from '../services/schemas/service.schema';
import { Transaction, TransactionDocument, TransactionType } from '../transactions/schemas/transaction.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { RegisterPaymentDto } from './dto/register-payment.dto';
import { BUSINESS_HOURS, SLOT_MINUTES, WORKING_WEEKDAYS } from './agenda.constants';

@Injectable()
export class AgendaService {
  constructor(
    @InjectModel(Appointment.name) private appointmentModel: Model<AppointmentDocument>,
    @InjectModel(Service.name) private serviceModel: Model<ServiceDocument>,
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    private notificationsService: NotificationsService,
  ) {}

  private toObjectId(value: string, fieldName: string) {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`${fieldName} must be a valid ObjectId`);
    }
    return new Types.ObjectId(value);
  }

  private async assertNoConflict(
    userId: Types.ObjectId,
    startAt: Date,
    endAt: Date,
    excludeId?: Types.ObjectId,
  ) {
    const filter: Record<string, unknown> = {
      userId,
      status: { $ne: AppointmentStatus.CANCELADO },
      startAt: { $lt: endAt },
      endAt: { $gt: startAt },
    };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    const conflict = await this.appointmentModel.findOne(filter).exec();
    if (conflict) {
      const fmt = (d: Date) => d.toISOString().slice(11, 16);
      throw new BadRequestException(
        `Horário conflita com um agendamento existente das ${fmt(conflict.startAt)} às ${fmt(conflict.endAt)}.`,
      );
    }
  }

  private computePaymentStatus(totalPaid: number, chargedValue: number): PaymentStatus {
    if (totalPaid <= 0) return PaymentStatus.NAO_PAGO;
    if (totalPaid >= chargedValue) return PaymentStatus.PAGO;
    return PaymentStatus.PARCIALMENTE_PAGO;
  }

  private async syncNotification(appointment: AppointmentDocument) {
    if (
      appointment.status === AppointmentStatus.CANCELADO ||
      appointment.paymentStatus === PaymentStatus.PAGO
    ) {
      await this.notificationsService.removeServiceBalanceNotification({
        userId: appointment.userId,
        appointmentId: appointment._id as Types.ObjectId,
      });
      return;
    }

    const pending = appointment.chargedValue - appointment.totalPaid;
    await this.notificationsService.upsertServiceBalanceNotification({
      userId: appointment.userId,
      appointmentId: appointment._id as Types.ObjectId,
      clientName: appointment.clientName,
      value: pending,
      date: appointment.startAt,
    });
  }

  async create(userId: string, dto: CreateAppointmentDto) {
    const userObjectId = this.toObjectId(userId, 'userId');
    const serviceObjectId = this.toObjectId(dto.serviceId, 'serviceId');

    const service = await this.serviceModel
      .findOne({ _id: serviceObjectId, userId: userObjectId })
      .exec();
    if (!service) {
      throw new BadRequestException('Serviço inválido para este usuário');
    }

    const startAt = new Date(dto.startAt);
    const endAt = new Date(startAt.getTime() + dto.durationMinutes * 60_000);

    await this.assertNoConflict(userObjectId, startAt, endAt);

    const appointment = await this.appointmentModel.create({
      userId: userObjectId,
      serviceId: serviceObjectId,
      clientName: dto.clientName,
      clientPhone: dto.clientPhone,
      startAt,
      durationMinutes: dto.durationMinutes,
      endAt,
      chargedValue: dto.chargedValue ?? service.defaultValue,
    });

    await this.syncNotification(appointment);
    return appointment;
  }

  async findAll(userId: string, date?: string) {
    const filter: Record<string, unknown> = { userId: this.toObjectId(userId, 'userId') };
    if (date) {
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const dayEnd = new Date(`${date}T23:59:59.999Z`);
      filter.startAt = { $gte: dayStart, $lte: dayEnd };
    }
    return this.appointmentModel.find(filter).sort({ startAt: 1 }).exec();
  }

  async findOne(userId: string, id: string) {
    const appointment = await this.appointmentModel
      .findOne({ _id: this.toObjectId(id, 'id'), userId: this.toObjectId(userId, 'userId') })
      .exec();
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }
    return appointment;
  }

  async getAvailability(userId: string, date: string, durationMinutes = SLOT_MINUTES) {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const weekday = dayStart.getUTCDay();
    if (!WORKING_WEEKDAYS.includes(weekday)) {
      return { date, slots: [] as string[] };
    }

    const appointments = await this.findAll(userId, date);
    const busy = appointments
      .filter((a) => a.status !== AppointmentStatus.CANCELADO)
      .map((a) => ({
        start: (a.startAt.getTime() - dayStart.getTime()) / 60_000,
        end: (a.endAt.getTime() - dayStart.getTime()) / 60_000,
      }));

    const slots: string[] = [];
    for (
      let minutes = BUSINESS_HOURS.startMinutes;
      minutes + durationMinutes <= BUSINESS_HOURS.endMinutes;
      minutes += SLOT_MINUTES
    ) {
      const slotEnd = minutes + durationMinutes;
      const overlaps = busy.some((b) => minutes < b.end && slotEnd > b.start);
      if (!overlaps) {
        const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
        const mm = String(minutes % 60).padStart(2, '0');
        slots.push(`${hh}:${mm}`);
      }
    }

    return { date, slots };
  }

  async update(userId: string, id: string, dto: UpdateAppointmentDto) {
    const appointment = await this.findOne(userId, id);
    if (typeof dto.clientName !== 'undefined') appointment.clientName = dto.clientName;
    if (typeof dto.clientPhone !== 'undefined') appointment.clientPhone = dto.clientPhone;
    if (typeof dto.chargedValue !== 'undefined') {
      appointment.chargedValue = dto.chargedValue;
      appointment.paymentStatus = this.computePaymentStatus(appointment.totalPaid, appointment.chargedValue);
    }
    await appointment.save();
    await this.syncNotification(appointment);
    return appointment;
  }

  async reschedule(userId: string, id: string, dto: RescheduleAppointmentDto) {
    const appointment = await this.findOne(userId, id);
    const startAt = new Date(dto.startAt);
    const endAt = new Date(startAt.getTime() + dto.durationMinutes * 60_000);

    await this.assertNoConflict(appointment.userId, startAt, endAt, appointment._id as Types.ObjectId);

    appointment.startAt = startAt;
    appointment.durationMinutes = dto.durationMinutes;
    appointment.endAt = endAt;
    appointment.status = AppointmentStatus.AGENDADO;
    await appointment.save();
    await this.syncNotification(appointment);
    return appointment;
  }

  async cancel(userId: string, id: string) {
    const appointment = await this.findOne(userId, id);
    appointment.status = AppointmentStatus.CANCELADO;
    await appointment.save();
    await this.syncNotification(appointment);
    return appointment;
  }

  async finish(userId: string, id: string) {
    const appointment = await this.findOne(userId, id);
    appointment.status = AppointmentStatus.FINALIZADO;
    await appointment.save();
    await this.syncNotification(appointment);
    return appointment;
  }

  async registerPayment(userId: string, id: string, dto: RegisterPaymentDto) {
    const appointment = await this.findOne(userId, id);
    const userObjectId = this.toObjectId(userId, 'userId');

    const service = await this.serviceModel.findById(appointment.serviceId).exec();
    if (!service) {
      throw new BadRequestException('Serviço vinculado não encontrado');
    }

    const transaction = await this.transactionModel.create({
      userId: userObjectId,
      type: TransactionType.INCOME,
      value: dto.value,
      categoryId: service.categoryId,
      description: `Pagamento - ${appointment.clientName}`,
      date: new Date(),
    });

    appointment.payments.push({
      method: dto.method,
      value: dto.value,
      paidAt: new Date(),
      transactionId: transaction._id as Types.ObjectId,
    });
    appointment.totalPaid += dto.value;
    appointment.paymentStatus = this.computePaymentStatus(appointment.totalPaid, appointment.chargedValue);
    await appointment.save();
    await this.syncNotification(appointment);
    return appointment;
  }

  async findAccountsReceivable(userId: string) {
    return this.appointmentModel
      .find({
        userId: this.toObjectId(userId, 'userId'),
        status: { $ne: AppointmentStatus.CANCELADO },
        paymentStatus: { $ne: PaymentStatus.PAGO },
      })
      .sort({ startAt: 1 })
      .exec();
  }
}
