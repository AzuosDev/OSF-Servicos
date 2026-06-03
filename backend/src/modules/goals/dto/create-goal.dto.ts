import { IsNotEmpty, IsString, IsNumber, Min, MaxLength, IsOptional, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGoalDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsNumber()
  @Type(() => Number)
  @Min(1)
  targetValue!: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  currentValue?: number;

  @IsOptional()
  @IsDateString()
  deadline?: string;
}
