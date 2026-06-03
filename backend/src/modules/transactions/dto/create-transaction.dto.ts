import { IsEnum, IsNotEmpty, IsOptional, IsString, IsNumber, Min, MaxLength, ValidateIf, IsDateString } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import sanitizeHtml from 'sanitize-html';
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
  @Transform(({ value }) => (typeof value === 'string' ? sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }) : value))
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsDateString()
  date!: string;
}
