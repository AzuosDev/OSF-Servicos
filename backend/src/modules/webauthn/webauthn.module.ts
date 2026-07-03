import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { WebAuthnService } from './webauthn.service';
import { WebAuthnController } from './webauthn.controller';
import { WebAuthnCredential, WebAuthnCredentialSchema } from './schemas/webauthn-credential.schema';
import { WebAuthnChallenge, WebAuthnChallengeSchema } from './schemas/webauthn-challenge.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: WebAuthnCredential.name, schema: WebAuthnCredentialSchema },
      { name: WebAuthnChallenge.name, schema: WebAuthnChallengeSchema },
    ]),
  ],
  controllers: [WebAuthnController],
  providers: [WebAuthnService],
})
export class WebAuthnModule {}
