import { IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateServiceDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  type?: string;

  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  defaultValue!: number;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a valid hex code' })
  color?: string;
}
