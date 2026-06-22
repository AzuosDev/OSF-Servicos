import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PendingAccountDocument = PendingAccount & Document;

@Schema({ timestamps: true })
export class PendingAccount {
  /**
   * Indica se a conta Ã© parcelada.
   * @default false
   */
  @Prop({ type: Boolean, default: false })
  isParcelada!: boolean;

  /**
   * Indica se a conta Ã© recorrente.
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
    enum: ['AlimentaÃ§Ã£o', 'Transporte', 'SaÃºde', 'EducaÃ§Ã£o', 'Lazer', 'Outro'],
    default: 'Outro',
  })
  categoria!: string;

  /**
   * Forma de pagamento.
   * @default 'Outro'
   */
  @Prop({
    type: String,
    enum: ['CartÃ£o de CrÃ©dito', 'Pix', 'Dinheiro', 'Outro'],
    default: 'Outro',
  })
  formatoPagamento!: string;

  @Prop({ type: Number })
  numeroParcela?: number;

  @Prop({ type: String })
  grupoParceladoId?: string;

  // Subdocumento de parcelas (presente apenas se isParcelada = true)
  @Prop({
    type: {
      totalParcelas: { type: Number, required: true },
      valorParcela: { type: Number, required: true },
      parcelasPayas: { type: Number, default: 0 },
      parcelasPagas: { type: [Number], default: [] },
      dataInicio: { type: Date, required: true },
      dataFim: { type: Date, required: true },
    },
    required: false,
  })
  parcelas?: {
    totalParcelas: number;
    valorParcela: number;
    parcelasPayas: number;
    parcelasPagas: number[];
    dataInicio: Date;
    dataFim: Date;
  };

  // Subdocumento de recorrÃªncia (presente apenas se isRecorrente = true)
  @Prop({
    type: {
      periodoRecorrencia: {
        type: String,
        enum: ['DiÃ¡rio', 'Semanal', 'Mensal', 'Anual'],
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

  @Prop()
  paidAt?: Date;

  @Prop({ maxlength: 500 })
  description?: string;
}

export const PendingAccountSchema = SchemaFactory.createForClass(PendingAccount);
PendingAccountSchema.index({ userId: 1, dueDate: 1 });



