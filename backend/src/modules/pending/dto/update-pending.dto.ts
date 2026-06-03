import { IsOptional, IsString, IsNumber, Min, MaxLength, IsDateString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePendingDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0.01)
  value?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsBoolean()
  paid?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
