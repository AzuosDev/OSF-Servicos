import { ArrayNotEmpty, IsArray, IsMongoId } from 'class-validator';

export class BulkWalletDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  transactionIds!: string[];

  @IsMongoId()
  targetWalletId!: string;
}
