import { IsOptional, IsString, IsNumber, Min, MaxLength, IsDateString, IsBoolean } from 'class-validator';
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

  // parcelas subdocumento
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  parcelas?: {
    @IsNumber()
    totalParcelas: number;
    @IsNumber()
    valorParcela?: number;
    @IsNumber()
    parcelasPayas?: number;
    @IsDateString()
    dataInicio: string;
    @IsDateString()
    dataFim: string;
  };

  // recorrencia subdocumento
  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  recorrencia?: {
    @IsIn(['Diário', 'Semanal', 'Mensal', 'Anual'])
    periodoRecorrencia: string;
    @IsDateString()
    dataProxima: string;
  };

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
