import { IsEnum, IsOptional, IsString, IsNumber, Min, MaxLength, ValidateIf, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType } from '../schemas/transaction.schema';

export class UpdateTransactionDto {
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0.01)
  value?: number;

  @ValidateIf((o) => o.type === TransactionType.EXPENSE || o.categoryId)
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}
