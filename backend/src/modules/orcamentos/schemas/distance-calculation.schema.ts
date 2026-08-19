import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DistanceCalculationDocument = DistanceCalculation & Document;

@Schema({ timestamps: true })
export class DistanceCalculation {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  originAddress!: string;

  @Prop({ required: true, trim: true })
  destinationAddress!: string;

  @Prop({ required: true, lowercase: true, trim: true })
  cacheKey!: string;

  @Prop({ required: true })
  distanceKm!: number;

  @Prop({ required: true })
  durationMin!: number;

  @Prop({ required: true, min: 0 })
  travelCost!: number;

  createdAt!: Date;
}

export const DistanceCalculationSchema = SchemaFactory.createForClass(DistanceCalculation);
DistanceCalculationSchema.index({ userId: 1, cacheKey: 1 });
// Cache expira sozinho após 30 dias — distância entre dois endereços não muda,
// mas o custo (pricePerKm/minimumTravelFee) pode, então o valor é recalculado a cada leitura.
DistanceCalculationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
