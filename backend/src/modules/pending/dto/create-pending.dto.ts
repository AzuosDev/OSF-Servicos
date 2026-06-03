import { IsNotEmpty, IsString, IsNumber, Min, MaxLength, IsDateString, IsOptional } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import sanitizeHtml from 'sanitize-html';

export class CreatePendingDto {
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }) : value))
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsNumber()
  @Type(() => Number)
  @Min(0.01)
  value!: number;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }) : value))
  @IsString()
  @MaxLength(500)
  description?: string;
}
