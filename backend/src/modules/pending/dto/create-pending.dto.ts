import { IsNotEmpty, IsString, IsNumber, IsInt, Min, MaxLength, IsDateString, IsOptional, IsBoolean, IsIn, ValidateIf, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import sanitizeHtml from 'sanitize-html';

export class ParcelasDto {
  @IsInt()
  @Min(2)
  @Type(() => Number)
  totalParcelas!: number;
}

export class RecorrenciaDto {
  @IsString()
  @IsIn(['Diário', 'Semanal', 'Mensal', 'Anual'])
  periodoRecorrencia!: string;

  @IsDateString()
  dataProxima!: string;
}

export class CreatePendingDto {
  @IsOptional()
  @IsBoolean()
  isParcelada?: boolean;

  @IsOptional()
  @IsBoolean()
  isRecorrente?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  categoria?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Cartão de Crédito', 'Pix', 'Dinheiro', 'Outro'])
  formatoPagamento?: string;

  @IsOptional()
  @ValidateIf(o => o.isParcelada)
  @ValidateNested()
  @Type(() => ParcelasDto)
  parcelas?: ParcelasDto;

  @IsOptional()
  @ValidateIf(o => o.isRecorrente)
  @ValidateNested()
  @Type(() => RecorrenciaDto)
  recorrencia?: RecorrenciaDto;

  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }) : value))
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsNumber()
  @Type(() => Number)
  @Min(0.01)
  value!: number;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }) : value))
  @IsString()
  @MaxLength(500)
  description?: string;
}
