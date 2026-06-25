import { IsOptional, IsInt, Min, Max, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class GetDashboardDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1970)
  year?: number;

  @IsOptional()
  @IsString()
  @IsIn(['weekly', 'monthly', 'yearly'])
  period?: 'weekly' | 'monthly' | 'yearly';
}
