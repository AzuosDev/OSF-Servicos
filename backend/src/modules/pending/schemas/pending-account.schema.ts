import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PendingAccountDocument = PendingAccount & Document;

@Schema({ timestamps: true })
export class PendingAccount {

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, maxlength: 200 })
  title!: string;

  @Prop({ required: true, min: 0.01 })
  value!: number;

  @Prop({ required: true })
  dueDate!: Date;

  @Prop({ default: false })
  paid!: boolean;

  @Prop()
  paidAt?: Date;

  @Prop({ maxlength: 500 })
  description?: string;
}

export const PendingAccountSchema = SchemaFactory.createForClass(PendingAccount);
PendingAccountSchema.index({ userId: 1, dueDate: 1 });
