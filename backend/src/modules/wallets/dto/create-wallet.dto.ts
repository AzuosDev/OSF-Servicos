import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWalletDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  saldo?: number;

  @IsOptional()
  @IsString()
  icone?: string;
}
