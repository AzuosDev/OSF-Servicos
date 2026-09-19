import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * Bloco do orçamento de venda de sistema fotovoltaico.
 *
 * Tudo aqui é *fotografia do momento da venda*, não referência viva: a garantia é copiada
 * das configurações da empresa, a geração é gravada já calculada e a irradiação usada fica
 * registrada. Mudar a configuração ou a fórmula depois não pode reescrever o que o cliente
 * já recebeu — é o mesmo princípio que `BudgetItem` aplica ao nome e ao preço do serviço.
 */

export enum SolarInverterType {
  INVERSOR = 'INVERSOR',
  MICROINVERSOR = 'MICROINVERSOR',
}

@Schema({ _id: false })
export class SolarPanelSpec {
  @Prop({ required: true, min: 1 })
  quantity!: number;

  /** Potência unitária em watt-pico, como vem no pedido da distribuidora. */
  @Prop({ required: true, min: 1 })
  wattagePeak!: number;

  @Prop({ trim: true, maxlength: 150 })
  model?: string;
}
export const SolarPanelSpecSchema = SchemaFactory.createForClass(SolarPanelSpec);

@Schema({ _id: false })
export class SolarInverterSpec {
  @Prop({ required: true, min: 1 })
  quantity!: number;

  @Prop({ required: true, enum: SolarInverterType })
  type!: SolarInverterType;

  @Prop({ trim: true, maxlength: 150 })
  model?: string;

  /** Potência unitária em watts, quando o pedido informa. */
  @Prop({ min: 0 })
  wattage?: number;
}
export const SolarInverterSpecSchema = SchemaFactory.createForClass(SolarInverterSpec);

/** Garantias em anos, copiadas das configurações da empresa no momento da criação. */
@Schema({ _id: false })
export class SolarWarranties {
  @Prop({ min: 0, max: 50 })
  panelEfficiencyYears?: number;

  @Prop({ min: 0, max: 50 })
  panelDefectYears?: number;

  @Prop({ min: 0, max: 50 })
  inverterYears?: number;

  @Prop({ min: 0, max: 50 })
  installationYears?: number;
}
export const SolarWarrantiesSchema = SchemaFactory.createForClass(SolarWarranties);

@Schema({ _id: false })
export class SolarMonthlyGeneration {
  /** 1 = janeiro … 12 = dezembro. */
  @Prop({ required: true, min: 1, max: 12 })
  month!: number;

  @Prop({ required: true, min: 0 })
  kwh!: number;
}
export const SolarMonthlyGenerationSchema = SchemaFactory.createForClass(SolarMonthlyGeneration);

@Schema({ _id: false })
export class SolarGeneration {
  @Prop({ required: true, min: 0 })
  systemPowerKwp!: number;

  @Prop({ required: true, min: 0, max: 1 })
  performanceRatio!: number;

  @Prop({ type: [SolarMonthlyGenerationSchema], required: true })
  monthly!: SolarMonthlyGeneration[];

  @Prop({ required: true, min: 0 })
  annualKwh!: number;

  @Prop({ required: true, min: 0 })
  averageMonthlyKwh!: number;

  @Prop({ required: true, min: 0 })
  averageWeeklyKwh!: number;

  /**
   * Irradiação (HSP) usada no cálculo, janeiro a dezembro. Guardada junto para que a
   * geração impressa possa ser reconferida anos depois, mesmo que a fonte mude.
   */
  @Prop({ type: [Number], required: true })
  monthlyIrradiance!: number[];
}
export const SolarGenerationSchema = SchemaFactory.createForClass(SolarGeneration);

@Schema({ _id: false })
export class SolarFinancials {
  /** Valor do pedido — é ele que vira o total do orçamento. */
  @Prop({ required: true, min: 0 })
  investment!: number;

  @Prop({ required: true, min: 0 })
  currentMonthlyBill!: number;

  @Prop({ required: true, min: 0 })
  projectedMonthlyBill!: number;

  @Prop({ required: true })
  monthlySavings!: number;

  @Prop({ required: true })
  annualSavings!: number;

  @Prop({ required: true, min: 1 })
  horizonYears!: number;

  @Prop({ required: true })
  totalSavings!: number;

  /** Ausente quando não há retorno a projetar — a fatura não caiu. */
  @Prop()
  irrPercent?: number;

  @Prop({ min: 0 })
  paybackMonths?: number;
}
export const SolarFinancialsSchema = SchemaFactory.createForClass(SolarFinancials);

@Schema({ _id: false })
export class SolarDetails {
  @Prop({ type: [SolarPanelSpecSchema], required: true })
  panels!: SolarPanelSpec[];

  @Prop({ type: [SolarInverterSpecSchema], required: true })
  inverters!: SolarInverterSpec[];

  @Prop({ type: SolarWarrantiesSchema, required: true })
  warranties!: SolarWarranties;

  /** Ausente enquanto não houver irradiação do local do cliente para calcular. */
  @Prop({ type: SolarGenerationSchema })
  generation?: SolarGeneration;

  @Prop({ type: SolarFinancialsSchema, required: true })
  financials!: SolarFinancials;
}
export const SolarDetailsSchema = SchemaFactory.createForClass(SolarDetails);
