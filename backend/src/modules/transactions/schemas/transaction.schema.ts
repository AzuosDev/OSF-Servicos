import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TransactionDocument = Transaction & Document;

export enum TransactionType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME',
}

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, enum: TransactionType })
  type!: TransactionType;

  @Prop({ required: true, min: 0.01 })
  value!: number;

  @Prop({ type: Types.ObjectId, ref: 'Category' })
  categoryId?: Types.ObjectId;

  @Prop({ maxlength: 500 })
  description?: string;

  @Prop({ required: true })
  date!: Date;

  @Prop({ type: Types.ObjectId, ref: 'PendingAccount' })
  pendingAccountId?: Types.ObjectId;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
TransactionSchema.index({ userId: 1, date: -1 });
