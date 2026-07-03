import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsOptional()
  @IsString()
  reauthedToken?: string;

  @IsString()
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres.' })
  @Matches(/(?=.*[A-Z])/, { message: 'A senha deve conter pelo menos uma letra maiúscula.' })
  @Matches(/(?=.*\d)/, { message: 'A senha deve conter pelo menos um número.' })
  newPassword!: string;
}
