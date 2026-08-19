import { IsDateString, IsEnum, IsInt, IsMongoId, IsOptional, IsPositive, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { BudgetStatus } from '../schemas/budget.schema';

export class GetBudgetsDto {
  @IsOptional()
  @IsEnum(BudgetStatus)
  status?: BudgetStatus;

  @IsOptional()
  @IsMongoId()
  clientId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;
}
