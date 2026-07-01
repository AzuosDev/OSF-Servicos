import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CategoryDocument = Category & Document;

@Schema({ timestamps: true })
export class Category {
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  userId?: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true })
  slug!: string;

  @Prop()
  icon?: string;

  @Prop()
  color?: string;

  @Prop({ default: false })
  isDefault!: boolean;

  @Prop({ default: false })
  isIncome!: boolean;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
CategorySchema.index({ slug: 1, isDefault: 1 }, { unique: true, sparse: true });
CategorySchema.index({ userId: 1 });
