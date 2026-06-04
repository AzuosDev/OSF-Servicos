import { IsEnum, IsOptional } from 'class-validator';

export enum ExpensePeriod {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export class GetExpensesDto {
  @IsOptional()
  @IsEnum(ExpensePeriod)
  period?: ExpensePeriod = ExpensePeriod.MONTHLY;
}
