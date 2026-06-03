import { IsEnum, IsNotEmpty, IsOptional, IsString, IsNumber, Min, MaxLength, ValidateIf, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType } from '../schemas/transaction.schema';

export class CreateTransactionDto {
  @IsEnum(TransactionType)
  type!: TransactionType;

  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  value!: number;

  @ValidateIf((o) => o.type === TransactionType.EXPENSE)
  @IsNotEmpty()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsDateString()
  date!: string;
}
