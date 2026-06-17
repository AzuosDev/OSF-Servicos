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

  /**
   * Indica se a conta é parcelada.
   * @default false
   */
  @Prop({ type: Boolean, default: false })
  isParcelada!: boolean;

  /**
   * Indica se a conta é recorrente.
   * @default false
   */
  @Prop({ type: Boolean, default: false })
  isRecorrente!: boolean;

  /**
   * Categoria da conta.
   * @default 'Outro'
   */
  @Prop({
    type: String,
    enum: ['Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Outro'],
    default: 'Outro',
  })
  categoria!: string;

  /**
   * Forma de pagamento.
   * @default 'Outro'
   */
  @Prop({
    type: String,
    enum: ['Cartão de Crédito', 'Pix', 'Dinheiro', 'Outro'],
    default: 'Outro',
  })
  formatoPagamento!: string;

  // Subdocumento de parcelas, presente somente se isParcelada = true
  @Prop({
    type: {
      totalParcelas: { type: Number, required: true },
      valorParcela: { type: Number, required: true },
      parcelasPayas: { type: Number, default: 0 },
      dataInicio: { type: Date, required: true },
      dataFim: { type: Date, required: true },
    },
    required: false,
  })
  parcelas?: {
    totalParcelas: number;
    valorParcela: number;
    parcelasPayas: number;
    dataInicio: Date;
    dataFim: Date;
  };

  // Subdocumento de recorrência, presente somente se isRecorrente = true
  @Prop({
    type: {
      periodoRecorrencia: {
        type: String,
        enum: ['Diário', 'Semanal', 'Mensal', 'Anual'],
        default: 'Mensal',
      },
      dataProxima: { type: Date, required: true },
    },
    required: false,
  })
  recorrencia?: {
    periodoRecorrencia: string;
    dataProxima: Date;
  };


  @Prop()
  paidAt?: Date;

  @Prop({ maxlength: 500 })
  description?: string;
}

export const PendingAccountSchema = SchemaFactory.createForClass(PendingAccount);
PendingAccountSchema.index({ userId: 1, dueDate: 1 });
