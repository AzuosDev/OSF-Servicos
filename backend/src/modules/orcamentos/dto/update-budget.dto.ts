import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import sanitizeHtml from 'sanitize-html';
import { CreateBudgetItemDto } from './create-budget-item.dto';

/**
 * Edição de um orçamento já criado. Todos os campos são opcionais — só o que vier no corpo
 * é alterado. Deslocamento e cliente ficam de fora: os dois dependem do cálculo de rota
 * feito na criação, e mudá-los aqui deixaria o orçamento inconsistente com o
 * `distanceCalculationId` gravado.
 */
export class UpdateBudgetDto {
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateBudgetItemDto)
  items?: CreateBudgetItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  discount?: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }) : value))
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
