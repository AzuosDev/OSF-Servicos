import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import sanitizeHtml from 'sanitize-html';

const clean = (value: unknown) => (typeof value === 'string' ? sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }) : value);

export class CreateClientDto {
  @IsNotEmpty()
  @Transform(({ value }) => clean(value))
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @IsNotEmpty()
  @Transform(({ value }) => clean(value))
  @IsString()
  @MaxLength(300)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string;

  @IsOptional()
  @Transform(({ value }) => clean(value))
  @IsString()
  @MaxLength(500)
  notes?: string;
}
