import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ServiceDocument = Service & Document;

@Schema({ timestamps: true })
export class Service {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 150 })
  name!: string;

  @Prop({ maxlength: 100 })
  type?: string;

  @Prop({ required: true, min: 0.01 })
  defaultValue!: number;

  @Prop({ default: true })
  active!: boolean;

  @Prop({ default: '#22C55E' })
  color!: string;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  categoryId!: Types.ObjectId;
}

export const ServiceSchema = SchemaFactory.createForClass(Service);
ServiceSchema.index({ userId: 1, active: 1 });
