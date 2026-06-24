import { IsOptional, IsString, IsNumber, Min, MaxLength, IsDateString, IsBoolean, IsIn, IsObject, ValidateIf } from 'class-validator';
import { Type, Transform } from 'class-transformer';
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
  @IsIn(['Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Outro'])
  categoria?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Cartão de Crédito', 'Pix', 'Dinheiro', 'Outro'])
  formatoPagamento?: string;

  @IsOptional()
  @ValidateIf(o => o.isParcelada)
  @IsObject()
  parcelas?: any;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  numeroParcela?: number;

  @IsOptional()
  @ValidateIf(o => o.isRecorrente)
  @IsObject()
  recorrencia?: any;

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
