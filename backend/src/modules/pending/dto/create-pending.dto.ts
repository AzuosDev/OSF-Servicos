import { IsNotEmpty, IsString, IsNumber, Min, MaxLength, IsDateString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePendingDto {
  @IsNotEmpty()
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
  @IsString()
  @MaxLength(500)
  description?: string;
}
