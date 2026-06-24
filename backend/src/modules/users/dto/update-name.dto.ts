import { IsString, MaxLength } from 'class-validator';

export class UpdateNameDto {
  @IsString()
  @MaxLength(100)
  name!: string;
}
