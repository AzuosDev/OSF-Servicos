import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNotEmptyObject,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import sanitizeHtml from 'sanitize-html';
import { CreateBudgetItemDto } from './create-budget-item.dto';
import { CreateSolarDetailsDto } from './create-solar-details.dto';
import { BudgetType } from '../schemas/budget.schema';

export class CreateBudgetDto {
  @IsMongoId()
  clientId!: string;

  /** Ausente significa SERVICOS — todo cliente antigo da API continua funcionando. */
  @IsOptional()
  @IsEnum(BudgetType)
  type?: BudgetType;

  // Serviços exigem itens; venda de sistema solar não tem item de catálogo nenhum, e sim o
  // bloco `solar` abaixo. As duas validações são espelhadas para que não exista orçamento
  // sem conteúdo nem orçamento com os dois preenchidos.
  @ValidateIf((dto: CreateBudgetDto) => dto.type !== BudgetType.SOLAR)
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateBudgetItemDto)
  items!: CreateBudgetItemDto[];

  @ValidateIf((dto: CreateBudgetDto) => dto.type === BudgetType.SOLAR)
  @IsNotEmptyObject({ nullable: false }, { message: 'Informe os dados do sistema solar' })
  @ValidateNested()
  @Type(() => CreateSolarDetailsDto)
  solar?: CreateSolarDetailsDto;

  @IsOptional()
  @IsBoolean()
  calculateDistance?: boolean;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }) : value))
  @IsString()
  @MaxLength(300)
  destinationAddress?: string;

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
