import { IsOptional, IsString, IsNumber, Min, MaxLength, IsDateString, IsBoolean, IsIn, ValidateNested, ValidateIf } from 'class-validator';
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
  @IsIn(['AlimentaÃ§Ã£o', 'Transporte', 'SaÃºde', 'EducaÃ§Ã£o', 'Lazer', 'Outro'])
  categoria?: string;

  @IsOptional()
  @IsString()
  @IsIn(['CartÃ£o de CrÃ©dito', 'Pix', 'Dinheiro', 'Outro'])
  formatoPagamento?: string;

  @IsOptional()
  @ValidateIf(o => o.isParcelada)
  @ValidateNested()
  @Type(() => Object)
  parcelas?: {
    totalParcelas: number;
    valorParcela?: number;
    parcelasPayas?: number;
    parcelasPagas?: number;
    dataInicio: string;
    dataFim: string;
  };

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  numeroParcela?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  recorrencia?: {
    periodoRecorrencia: string;
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
