import { IsNotEmpty, IsString, IsNumber, Min, MaxLength, IsDateString, IsOptional, IsBoolean, IsIn, ValidateNested, ValidateIf, IsObject } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import sanitizeHtml from 'sanitize-html';

export class CreatePendingDto {
  @IsOptional()
  @IsBoolean()
  isParcelada?: boolean;

  @IsOptional()
  @IsBoolean()
  isRecorrente?: boolean;

  @IsOptional()
  @IsOptional()
  @IsString()
  @IsIn(['Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Outro'])
  categoria?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Cartão de Crédito', 'Pix', 'Dinheiro', 'Outro'])
  formatoPagamento?: string;

  // parcelas subdocumento – aceita qualquer objeto quando a conta for parcelada
  @IsOptional()
  @ValidateIf(o => o.isParcelada)
  @IsObject()
  parcelas?: any;

  // recorrencia subdocumento – aceita qualquer objeto quando a conta for recorrente
  @IsOptional()
  @ValidateIf(o => o.isRecorrente)
  @IsObject()
  recorrencia?: any;

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
