import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type InvoiceDocument = Invoice & Document;

export type InvoiceStatus = 'pending' | 'paid' | 'cancelled';

/**
 * Uma parcela da mensalidade do app, gerada automaticamente todo dia 28.
 * Fica pendente indefinidamente até ser paga — não bloqueia o uso do app,
 * mas se acumula com os meses seguintes (ver BillingService.getPendingSummary).
 */
@Schema({ timestamps: true })
export class Invoice {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  /** Mês de referência da mensalidade, formato 'YYYY-MM'. */
  @Prop({ required: true })
  referenceMonth!: string;

  @Prop({ required: true })
  amount!: number;

  @Prop({ type: String, enum: ['pending', 'paid', 'cancelled'], default: 'pending', index: true })
  status!: InvoiceStatus;

  @Prop({ required: true, type: Date })
  dueDate!: Date;

  /** Id do payment na Asaas que cobre esta parcela — várias parcelas em atraso podem compartilhar o mesmo paymentId quando cobradas juntas. */
  @Prop({ type: String, default: null })
  asaasPaymentId?: string | null;

  @Prop({ type: Date, default: null })
  paidAt?: Date | null;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);

InvoiceSchema.index({ userId: 1, referenceMonth: 1 }, { unique: true });
InvoiceSchema.index({ userId: 1, status: 1 });
InvoiceSchema.index({ asaasPaymentId: 1 });
