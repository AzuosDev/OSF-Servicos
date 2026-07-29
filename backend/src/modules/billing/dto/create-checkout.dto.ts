import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateCheckoutDto {
  @IsIn(['aklavajato'])
  plan!: string;

  @IsIn(['stripe', 'pix'])
  method!: 'stripe' | 'pix';

  @IsOptional()
  @IsString()
  cpfCnpj?: string;
}
