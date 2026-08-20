import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CompanySettingsDocument = CompanySettings & Document;

@Schema({ timestamps: true })
export class CompanySettings {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 150 })
  companyName!: string;

  @Prop({ trim: true, maxlength: 20 })
  cnpj?: string;

  @Prop({ trim: true, maxlength: 300 })
  baseAddress?: string;

  // Quando preenchidas, o cálculo de deslocamento usa essas coordenadas como ponto de partida
  // em vez de geocodificar `baseAddress` — útil para endereços rurais/sem numeração que a ORS
  // não consegue localizar por texto.
  @Prop({ min: -90, max: 90 })
  originLat?: number;

  @Prop({ min: -180, max: 180 })
  originLng?: number;

  @Prop({ trim: true, maxlength: 30 })
  phone?: string;

  @Prop({ trim: true, maxlength: 150 })
  email?: string;

  @Prop({ trim: true, maxlength: 100 })
  instagram?: string;

  @Prop({ trim: true, maxlength: 300 })
  logoUrl?: string;

  @Prop({ required: true, min: 0, default: 0 })
  pricePerKm!: number;

  @Prop({ required: true, min: 0, default: 0 })
  minimumTravelFee!: number;

  @Prop({ required: true, min: 0, default: 0 })
  freeRadiusKm!: number;

  @Prop({ trim: true, maxlength: 1000 })
  pdfFooterNote?: string;
}

export const CompanySettingsSchema = SchemaFactory.createForClass(CompanySettings);
CompanySettingsSchema.index({ userId: 1 }, { unique: true });
