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

  async upsertNotification(data: {
    userId: Types.ObjectId;
    pendingAccountId: Types.ObjectId;
    type: NotificationType;
    title: string;
    message: string;
    generatedDate: Date;
  }) {
    const { userId, pendingAccountId, type, generatedDate } = data;
    const exists = await this.notificationModel.exists({
      userId,
      pendingAccountId,
      type,
      generatedDate,
    });
    if (exists) return;
    await this.notificationModel.create(data);
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
