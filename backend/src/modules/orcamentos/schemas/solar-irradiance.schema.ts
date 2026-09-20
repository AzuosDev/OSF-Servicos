import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SolarIrradianceDocument = SolarIrradiance & Document;

/**
 * Cache da irradiação média mensal (HSP) de um ponto do mapa.
 *
 * Não tem `userId` de propósito: a irradiação de uma coordenada é um dado público do clima,
 * igual para todo mundo. Dois orçamentos na mesma cidade reaproveitam a mesma linha, e a
 * segunda venda não faz requisição nenhuma.
 */
@Schema({ timestamps: true })
export class SolarIrradiance {
  /** Coordenada arredondada — ver `irradianceCacheKey`. */
  @Prop({ required: true, unique: true, trim: true })
  cacheKey!: string;

  @Prop({ required: true, min: -90, max: 90 })
  lat!: number;

  @Prop({ required: true, min: -180, max: 180 })
  lon!: number;

  /** Doze médias diárias em kWh/m²/dia, de janeiro a dezembro. */
  @Prop({ type: [Number], required: true })
  monthly!: number[];

  /** De onde veio o dado, para auditoria caso a fonte mude. */
  @Prop({ required: true, trim: true })
  source!: string;

  createdAt!: Date;
}

export const SolarIrradianceSchema = SchemaFactory.createForClass(SolarIrradiance);
// Sem TTL: clima médio de um ponto não muda de um ano para o outro, e a normal climatológica
// da NASA só é revisada de tempos em tempos. Expirar o cache só geraria requisição à toa.
