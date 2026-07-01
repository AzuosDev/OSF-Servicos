import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class TransferWalletDto {
  @IsString()
  @IsNotEmpty()
  carteiraOrigemId!: string;

  @IsString()
  @IsNotEmpty()
  carteiraDestinoId!: string;

  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  value!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  date!: string;
}
