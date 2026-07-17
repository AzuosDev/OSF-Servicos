import { IsDateString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RescheduleAppointmentDto {
  @IsDateString()
  startAt!: string;

  @IsNumber()
  @Min(5)
  @Type(() => Number)
  durationMinutes!: number;
}
