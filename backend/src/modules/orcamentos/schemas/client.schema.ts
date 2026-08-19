import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ClientDocument = Client & Document;

@Schema({ timestamps: true })
export class Client {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 150 })
  name!: string;

  @Prop({ trim: true, maxlength: 30 })
  phone?: string;

  @Prop({ trim: true, maxlength: 150 })
  email?: string;

  @Prop({ required: true, trim: true, maxlength: 300 })
  address!: string;

  @Prop({ trim: true, maxlength: 100 })
  city?: string;

  @Prop({ trim: true, maxlength: 2 })
  state?: string;

  @Prop({ trim: true, maxlength: 500 })
  notes?: string;

  @Prop({ default: true })
  active!: boolean;
}

export const ClientSchema = SchemaFactory.createForClass(Client);
ClientSchema.index({ userId: 1, active: 1 });
ClientSchema.index({ userId: 1, name: 1 });
