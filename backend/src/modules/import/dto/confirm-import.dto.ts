import { IsArray, IsEnum, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType } from '../../transactions/schemas/transaction.schema';

export class ConfirmTransactionDto {
  @IsOptional()
  @IsString()
  fitId?: string | null;

  @IsString()
  @IsNotEmpty()
  date!: string;

  @IsNumber()
  @Min(0.01)
  @Max(1_000_000_000)
  @Type(() => Number)
  value!: number;

  @IsEnum(TransactionType)
  type!: TransactionType;

  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  description?: string;
}

export class ConfirmImportDto {
  @IsString()
  @IsNotEmpty()
  carteiraId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmTransactionDto)
  transactions!: ConfirmTransactionDto[];
}
