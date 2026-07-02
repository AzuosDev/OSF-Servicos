import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ImportBatchDocument = ImportBatch & Document;

@Schema({ timestamps: true })
export class ImportBatch {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Wallet', required: true })
  carteiraId!: Types.ObjectId;

  @Prop({ type: String, maxlength: 255 })
  fileName?: string;

  @Prop({ required: true, min: 0 })
  transactionCount!: number;
}

export const ImportBatchSchema = SchemaFactory.createForClass(ImportBatch);
ImportBatchSchema.index({ userId: 1, carteiraId: 1, createdAt: -1 });
