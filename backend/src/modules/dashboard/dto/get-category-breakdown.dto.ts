import { IsDateString, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType } from '../../transactions/schemas/transaction.schema';

export type BreakdownPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export class GetCategoryBreakdownDto {
  @IsIn([TransactionType.EXPENSE, TransactionType.INCOME])
  type!: TransactionType.EXPENSE | TransactionType.INCOME;

  @IsIn(['daily', 'weekly', 'monthly', 'yearly'])
  period!: BreakdownPeriod;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1970)
  year?: number;
}
