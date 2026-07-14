import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

export type NotificationType =
  | 'VENCIDA_PAGAR'
  | 'VENCIDA_RECEBER'
  | 'VENCE_HOJE_PAGAR'
  | 'VENCE_HOJE_RECEBER';

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['VENCIDA_PAGAR', 'VENCIDA_RECEBER', 'VENCE_HOJE_PAGAR', 'VENCE_HOJE_RECEBER'],
    required: true,
  })
  type!: NotificationType;

  @Prop({ required: true, maxlength: 200 })
  title!: string;

  @Prop({ required: true, maxlength: 500 })
  message!: string;

  @Prop({ type: Types.ObjectId, ref: 'PendingAccount', required: true })
  pendingAccountId!: Types.ObjectId;

  @Prop({ default: false })
  read!: boolean;

  @Prop({ required: true, type: Date })
  generatedDate!: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index(
  { userId: 1, pendingAccountId: 1, type: 1, generatedDate: 1 },
  { unique: true },
);
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
