import { IsInt, IsMongoId, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBudgetItemDto {
  @IsMongoId()
  serviceId!: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  unitPriceOverride?: number;
}
