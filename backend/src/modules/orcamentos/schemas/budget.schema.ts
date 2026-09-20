import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { SolarDetails, SolarDetailsSchema } from './solar-details.schema';

/**
 * Orçamento de serviços (o fluxo original) ou de venda de sistema fotovoltaico.
 * O default é SERVICOS para que todo orçamento já gravado continue válido sem migração.
 */
export enum BudgetType {
  SERVICOS = 'SERVICOS',
  SOLAR = 'SOLAR',
}

export enum BudgetStatus {
  RASCUNHO = 'RASCUNHO',
  ENVIADO = 'ENVIADO',
  APROVADO = 'APROVADO',
  REJEITADO = 'REJEITADO',
  EXPIRADO = 'EXPIRADO',
  CANCELADO = 'CANCELADO',
}

@Schema({ _id: false })
export class BudgetItem {
  @Prop({ type: Types.ObjectId, ref: 'Service', required: true })
  serviceId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 150 })
  name!: string;

  @Prop({ required: true, min: 0.01 })
  unitPrice!: number;

  @Prop({ required: true, min: 1 })
  quantity!: number;

  @Prop({ required: true, min: 0 })
  subtotal!: number;
}

export const BudgetItemSchema = SchemaFactory.createForClass(BudgetItem);

export type BudgetDocument = Budget & Document;

@Schema({ timestamps: true })
export class Budget {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  sequenceNumber!: number;

  @Prop({ type: Types.ObjectId, ref: 'Client', required: true })
  clientId!: Types.ObjectId;

  @Prop({ required: true, enum: BudgetType, default: BudgetType.SERVICOS })
  type!: BudgetType;

  // Serviços do catálogo. No orçamento de serviços são o documento inteiro; na venda solar
  // são os adicionais (instalação de padrão, alvenaria...), somados ao valor do sistema.
  // O equipamento solar nunca entra aqui: `buildItems` resolve todo item contra o catálogo
  // para garantir o preço, e painel e inversor vivem em `solar.panels/inverters`.
  @Prop({ type: [BudgetItemSchema], required: true, default: [] })
  items!: BudgetItem[];

  /** Presente apenas quando `type` é SOLAR. */
  @Prop({ type: SolarDetailsSchema })
  solar?: SolarDetails;

  @Prop({ required: true, min: 0 })
  itemsTotal!: number;

  @Prop({ required: true, min: 0, default: 0 })
  travelCost!: number;

  @Prop({ min: 0, default: 0 })
  discount!: number;

  @Prop({ required: true, min: 0 })
  total!: number;

  @Prop({ type: Types.ObjectId, ref: 'DistanceCalculation' })
  distanceCalculationId?: Types.ObjectId;

  @Prop({ required: true, enum: BudgetStatus, default: BudgetStatus.RASCUNHO })
  status!: BudgetStatus;

  @Prop({ trim: true, maxlength: 1000 })
  notes?: string;

  @Prop({ trim: true, maxlength: 500 })
  statusReason?: string;

  @Prop({ type: Date })
  validUntil?: Date;

  @Prop({ type: Date })
  sentAt?: Date;

  @Prop({ type: Date })
  respondedAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export const BudgetSchema = SchemaFactory.createForClass(Budget);
BudgetSchema.index({ userId: 1, sequenceNumber: 1 }, { unique: true });
BudgetSchema.index({ userId: 1, status: 1 });
BudgetSchema.index({ userId: 1, clientId: 1 });
