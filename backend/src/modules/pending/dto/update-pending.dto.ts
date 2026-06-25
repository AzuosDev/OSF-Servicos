import { IsOptional, IsString, IsNumber, Min, MaxLength, IsDateString, IsBoolean, IsIn, ValidateIf, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ParcelasDto, RecorrenciaDto } from './create-pending.dto';
import sanitizeHtml from 'sanitize-html';

export class UpdatePendingDto {
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
  @Type(() => Number)
  @IsNumber()
  numeroParcela?: number;

  @IsOptional()
  @ValidateIf(o => o.isRecorrente)
  @ValidateNested()
  @Type(() => RecorrenciaDto)
  recorrencia?: RecorrenciaDto;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }) : value))
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0.01)
  value?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsBoolean()
  paid?: boolean;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }) : value))
  @IsString()
  @MaxLength(500)
  description?: string;
}
