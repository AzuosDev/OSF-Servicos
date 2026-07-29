import { Type } from 'class-transformer';
import { IsOptional, IsString, IsUrl, ValidateNested } from 'class-validator';

class PushSubscriptionKeysDto {
  @IsString()
  p256dh!: string;

  @IsString()
  auth!: string;
}

export class PushSubscriptionDto {
  @IsUrl({ require_tld: false })
  endpoint!: string;

  @IsOptional()
  expirationTime?: number | null;

  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys!: PushSubscriptionKeysDto;
}
