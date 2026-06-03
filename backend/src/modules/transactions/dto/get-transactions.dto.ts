import { IsEnum, IsOptional, IsPositive, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType } from '../schemas/transaction.schema';

export class GetTransactionsDto {
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  limit?: number = 10;
}
