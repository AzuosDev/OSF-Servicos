import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import sanitizeHtml from 'sanitize-html';
import { SolarInverterType } from '../schemas/solar-details.schema';

const clean = (value: unknown) =>
  typeof value === 'string' ? sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }) : value;

export class CreateSolarPanelDto {
  @IsInt()
  @Min(1)
  @Max(10000)
  @Type(() => Number)
  quantity!: number;

  /** Potência unitária em watt-pico. O teto cobre folgadamente qualquer módulo de mercado. */
  @IsInt()
  @Min(1)
  @Max(2000)
  @Type(() => Number)
  wattagePeak!: number;

  @IsOptional()
  @Transform(({ value }) => clean(value))
  @IsString()
  @MaxLength(150)
  model?: string;
}

export class CreateSolarInverterDto {
  @IsInt()
  @Min(1)
  @Max(10000)
  @Type(() => Number)
  quantity!: number;

  @IsEnum(SolarInverterType)
  type!: SolarInverterType;

  @IsOptional()
  @Transform(({ value }) => clean(value))
  @IsString()
  @MaxLength(150)
  model?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000000)
  @Type(() => Number)
  wattage?: number;
}

export class CreateSolarDetailsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreateSolarPanelDto)
  panels!: CreateSolarPanelDto[];

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreateSolarInverterDto)
  inverters!: CreateSolarInverterDto[];

  /** Valor do pedido da distribuidora — vira o total do orçamento. */
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  investment!: number;

  /** Fatura de energia hoje. Informada manualmente: não vem no pedido da distribuidora. */
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  currentMonthlyBill!: number;

  /** Fatura estimada depois do sistema instalado. Também manual. */
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  projectedMonthlyBill!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  horizonYears?: number;

  /**
   * Rendimento global do sistema. Opcional — sem ele vale o padrão do módulo de cálculo.
   */
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(1)
  @Type(() => Number)
  performanceRatio?: number;

  /**
   * Irradiação mensal (HSP) do local do cliente, janeiro a dezembro.
   *
   * Opcional nesta etapa: sem ela o orçamento é criado sem o bloco de geração. A busca
   * automática pela coordenada do cliente entra na fase seguinte — quando entrar, este
   * campo vira apenas a forma de sobrescrever o valor buscado.
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(12, { message: 'A irradiação precisa ter os 12 meses' })
  @ArrayMaxSize(12, { message: 'A irradiação precisa ter os 12 meses' })
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  @Max(15, { each: true })
  @Type(() => Number)
  monthlyIrradiance?: number[];
}
