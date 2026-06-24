import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GoalDocument = Goal & Document;

@Schema({ timestamps: true })
export class Goal {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, maxlength: 200 })
  name!: string;

  @Prop({ required: true, min: 1 })
  targetValue!: number;

  @Prop({ default: 0, min: 0 })
  currentValue!: number;

  @Prop()
  deadline?: Date;

  @Prop({ default: false })
  completed!: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Category', default: null })
  linkedCategoryId?: Types.ObjectId | null;
}

export const GoalSchema = SchemaFactory.createForClass(Goal);
GoalSchema.index({ userId: 1 });
