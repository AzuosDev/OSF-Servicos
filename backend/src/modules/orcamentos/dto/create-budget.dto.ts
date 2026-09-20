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

  /**
   * Serviços do catálogo.
   *
   * Obrigatório e não-vazio no orçamento de serviços — lá é o conteúdo do documento. Na
   * venda solar é opcional: são os serviços adicionais somados ao sistema (instalação de
   * padrão, alvenaria, etc.), e o conteúdo obrigatório é o bloco `solar`.
   *
   * A condição cobre a propriedade inteira porque `@ValidateIf` desliga **todos** os
   * validadores quando é falsa — então ela só pula a validação quando não há nada para
   * validar. Item que vier num orçamento solar passa pelas mesmas regras de sempre.
   */
  @ValidateIf(
    (dto: CreateBudgetDto) =>
      dto.type !== BudgetType.SOLAR || (Array.isArray(dto.items) && dto.items.length > 0),
  )
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
