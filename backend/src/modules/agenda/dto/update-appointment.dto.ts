import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateAppointmentDto {
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  clientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  clientPhone?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  chargedValue?: number;
}
