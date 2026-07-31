import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument, NotificationType } from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  /** Retorna true quando a notificação é nova (ainda não existia). */
  async upsertNotification(data: {
    userId: Types.ObjectId;
    pendingAccountId: Types.ObjectId;
    type: NotificationType;
    title: string;
    message: string;
    generatedDate: Date;
  }): Promise<boolean> {
    const { userId, pendingAccountId, type, generatedDate } = data;
    const exists = await this.notificationModel.exists({
      userId,
      pendingAccountId,
      type,
      generatedDate,
    });
    if (exists) return false;
    await this.notificationModel.create(data);
    return true;
  }

  async upsertServiceBalanceNotification(data: {
    userId: Types.ObjectId;
    appointmentId: Types.ObjectId;
    clientName: string;
    value: number;
    date: Date;
  }) {
    const { userId, appointmentId, clientName, value, date } = data;
    const valueFormatted = value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    await this.notificationModel
      .findOneAndUpdate(
        { userId, appointmentId, type: 'SALDO_PENDENTE_SERVICO' },
        {
          $set: {
            userId,
            appointmentId,
            type: 'SALDO_PENDENTE_SERVICO',
            title: 'Saldo pendente de serviço',
            message: `${clientName} — R$ ${valueFormatted} pendente`,
            generatedDate: date,
            read: false,
          },
        },
        { upsert: true },
      )
      .exec();
  }

  async removeServiceBalanceNotification(data: { userId: Types.ObjectId; appointmentId: Types.ObjectId }) {
    await this.notificationModel
      .deleteOne({ userId: data.userId, appointmentId: data.appointmentId, type: 'SALDO_PENDENTE_SERVICO' })
      .exec();
  }

  /** Retorna se a notificação é nova (agendamento ainda não havia sido sinalizado), junto do título/mensagem gerados — reaproveitados pelo push individual do cron. */
  async upsertServiceNotCompletedNotification(data: {
    userId: Types.ObjectId;
    appointmentId: Types.ObjectId;
    clientName: string;
    date: Date;
  }): Promise<{ isNew: boolean; title: string; message: string }> {
    const { userId, appointmentId, clientName, date } = data;
    const existed = await this.notificationModel.exists({
      userId,
      appointmentId,
      type: 'SERVICO_NAO_CONCLUIDO',
    });
    const dateFormatted = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const title = 'Serviço não concluído';
    const message = `Atendimento de ${clientName} em ${dateFormatted} ainda não foi marcado como concluído.`;
    await this.notificationModel
      .findOneAndUpdate(
        { userId, appointmentId, type: 'SERVICO_NAO_CONCLUIDO' },
        {
          $set: {
            userId,
            appointmentId,
            type: 'SERVICO_NAO_CONCLUIDO',
            title,
            message,
            generatedDate: date,
            read: false,
          },
        },
        { upsert: true },
      )
      .exec();
    return { isNew: !existed, title, message };
  }

  async findUnreadByUser(userId: Types.ObjectId) {
    return this.notificationModel
      .find({ userId, read: false })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
      .exec();
  }

  async markAsRead(id: string, userId: Types.ObjectId) {
    await this.notificationModel.updateOne(
      { _id: new Types.ObjectId(id), userId },
      { $set: { read: true } },
    );
  }

  async markAllAsRead(userId: Types.ObjectId) {
    await this.notificationModel.updateMany(
      { userId, read: false },
      { $set: { read: true } },
    );
  }
}
