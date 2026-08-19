import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import sanitizeHtml from 'sanitize-html';
import { BudgetStatus } from '../schemas/budget.schema';

export class UpdateBudgetStatusDto {
  @IsEnum(BudgetStatus)
  status!: BudgetStatus;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }) : value))
  @IsString()
  @MaxLength(500)
  reason?: string;
}
