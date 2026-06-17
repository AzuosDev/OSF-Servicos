import { IsNotEmpty, IsString, IsNumber, Min, MaxLength, IsDateString, IsOptional, IsBoolean, IsIn, ValidateNested } from 'class-validator';
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
  @IsString()
  @IsIn(['Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Outro'])
  categoria?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Cartão de Crédito', 'Pix', 'Dinheiro', 'Outro'])
  formatoPagamento?: string;

  // parcelas subdocumento (validation applied to fields individually)
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  parcelas?: {
    totalParcelas: number;
    valorParcela?: number;
    parcelasPayas?: number;
    dataInicio: string;
    dataFim: string;
  };

  // recorrencia subdocumento
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  recorrencia?: {
    periodoRecorrencia: string;
    dataProxima: string;
  };

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
