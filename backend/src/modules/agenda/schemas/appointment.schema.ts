import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AppointmentDocument = Appointment & Document;

export enum AppointmentStatus {
  AGENDADO = 'AGENDADO',
  EM_ANDAMENTO = 'EM_ANDAMENTO',
  FINALIZADO = 'FINALIZADO',
  CANCELADO = 'CANCELADO',
}

export enum PaymentStatus {
  NAO_PAGO = 'NAO_PAGO',
  PARCIALMENTE_PAGO = 'PARCIALMENTE_PAGO',
  PAGO = 'PAGO',
}

export enum PaymentMethod {
  PIX = 'PIX',
  DINHEIRO = 'DINHEIRO',
  CARTAO = 'CARTAO',
}

@Schema({ _id: false })
export class AppointmentPayment {
  @Prop({ required: true, enum: PaymentMethod })
  method!: PaymentMethod;

  @Prop({ required: true, min: 0.01 })
  value!: number;

  @Prop({ required: true, type: Date })
  paidAt!: Date;

  @Prop({ type: Types.ObjectId, ref: 'Transaction' })
  transactionId?: Types.ObjectId;
}

@Schema({ timestamps: true })
export class Appointment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Service', required: true })
  serviceId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 150 })
  clientName!: string;

  @Prop({ maxlength: 30 })
  clientPhone?: string;

  @Prop({ required: true, type: Date })
  startAt!: Date;

  @Prop({ required: true, min: 5 })
  durationMinutes!: number;

  @Prop({ required: true, type: Date })
  endAt!: Date;

  @Prop({ required: true, min: 0 })
  chargedValue!: number;

  @Prop({ required: true, enum: AppointmentStatus, default: AppointmentStatus.AGENDADO })
  status!: AppointmentStatus;

  @Prop({ required: true, enum: PaymentStatus, default: PaymentStatus.NAO_PAGO })
  paymentStatus!: PaymentStatus;

  @Prop({ default: 0, min: 0 })
  totalPaid!: number;

  @Prop({ type: [AppointmentPayment], default: [] })
  payments!: AppointmentPayment[];
}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);
AppointmentSchema.index({ userId: 1, startAt: 1 });
AppointmentSchema.index({ userId: 1, status: 1 });
AppointmentSchema.index({ userId: 1, paymentStatus: 1 });
