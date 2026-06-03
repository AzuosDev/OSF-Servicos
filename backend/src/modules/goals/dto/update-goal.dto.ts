import { IsOptional, IsString, IsNumber, Min, MaxLength, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateGoalDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  targetValue?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  currentValue?: number;

  @IsOptional()
  @IsDateString()
  deadline?: string;
}
