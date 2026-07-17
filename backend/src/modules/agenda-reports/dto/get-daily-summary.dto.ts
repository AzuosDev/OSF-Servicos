import { IsDateString, IsOptional } from 'class-validator';

export class GetDailySummaryDto {
  @IsOptional()
  @IsDateString()
  date?: string;
}
