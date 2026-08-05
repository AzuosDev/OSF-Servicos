import { IsOptional, IsString } from 'class-validator';

export class PendingCheckoutDto {
  /** Obrigatório apenas se o usuário ainda não tem um customer Asaas cadastrado. */
  @IsOptional()
  @IsString()
  cpfCnpj?: string;
}
