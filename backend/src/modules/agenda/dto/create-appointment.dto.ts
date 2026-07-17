import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAppointmentDto {
  @IsNotEmpty()
  @IsString()
  serviceId!: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  clientName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  clientPhone?: string;

  // ISO datetime combinando data + hora de início (ex.: 2026-07-16T09:00:00.000Z)
  @IsDateString()
  startAt!: string;

  @IsNumber()
  @Min(5)
  @Type(() => Number)
  durationMinutes!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  chargedValue?: number;
}
