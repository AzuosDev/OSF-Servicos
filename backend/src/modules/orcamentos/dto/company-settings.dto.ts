import { IsNotEmpty, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import sanitizeHtml from 'sanitize-html';

const clean = (value: unknown) => (typeof value === 'string' ? sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }) : value);

export class CompanySettingsDto {
  @IsNotEmpty()
  @Transform(({ value }) => clean(value))
  @IsString()
  @MaxLength(150)
  companyName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cnpj?: string;

  @IsNotEmpty()
  @Transform(({ value }) => clean(value))
  @IsString()
  @MaxLength(300)
  baseAddress!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  logoUrl?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  pricePerKm!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minimumTravelFee!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  freeRadiusKm!: number;

  @IsOptional()
  @Transform(({ value }) => clean(value))
  @IsString()
  @MaxLength(1000)
  pdfFooterNote?: string;
}
