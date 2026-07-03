import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture, RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/server';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';
import { WebAuthnCredential, WebAuthnCredentialDocument } from './schemas/webauthn-credential.schema';
import { WebAuthnChallenge, WebAuthnChallengeDocument } from './schemas/webauthn-challenge.schema';

@Injectable()
export class WebAuthnService {
  private readonly rpName: string;
  private readonly rpID: string;
  private readonly origin: string;

  constructor(
    @InjectModel(WebAuthnCredential.name)
    private credentialModel: Model<WebAuthnCredentialDocument>,
    @InjectModel(WebAuthnChallenge.name)
    private challengeModel: Model<WebAuthnChallengeDocument>,
    private usersService: UsersService,
    private authService: AuthService,
    configService: ConfigService,
  ) {
    this.rpName = configService.get<string>('WEBAUTHN_RP_NAME') ?? 'ContaCerta';
    this.rpID = configService.get<string>('WEBAUTHN_RP_ID') ?? 'localhost';
    this.origin = configService.get<string>('WEBAUTHN_ORIGIN') ?? 'http://localhost:5173';
  }

  async getRegistrationOptions(userId: string) {
    const user = await this.usersService.findById(userId);

    const existing = await this.credentialModel
      .find({ userId: new Types.ObjectId(userId) })
      .exec();

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userName: user.email as string,
      attestationType: 'none',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        requireResidentKey: false,
        userVerification: 'preferred',
      },
      excludeCredentials: existing.map((c) => ({
        id: c.credentialId,
        transports: c.transports as AuthenticatorTransportFuture[],
      })),
    });

    // Remove any stale register challenges for this user before storing a new one
    await this.challengeModel
      .deleteMany({ userId: new Types.ObjectId(userId), type: 'register' })
      .exec();

    await this.challengeModel.create({
      challenge: options.challenge,
      type: 'register',
      userId: new Types.ObjectId(userId),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    return options;
  }

  async verifyRegistration(userId: string, response: RegistrationResponseJSON) {
    const stored = await this.challengeModel
      .findOne({
        userId: new Types.ObjectId(userId),
        type: 'register',
        expiresAt: { $gt: new Date() },
      })
      .exec();

    if (!stored) throw new BadRequestException('Desafio inválido ou expirado');

    const { verified, registrationInfo } = await verifyRegistrationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
      requireUserVerification: false,
    });

    if (!verified || !registrationInfo) {
      throw new UnauthorizedException('Verificação biométrica falhou');
    }

    await this.challengeModel.findByIdAndDelete(stored._id).exec();

    const { credential, credentialDeviceType, credentialBackedUp } = registrationInfo;

    await this.credentialModel
      .findOneAndUpdate(
        { credentialId: credential.id },
        {
          userId: new Types.ObjectId(userId),
          credentialId: credential.id,
          publicKey: Buffer.from(credential.publicKey).toString('base64url'),
          counter: credential.counter,
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
          transports: credential.transports ?? [],
        },
        { upsert: true, new: true },
      )
      .exec();

    return { registered: true };
  }

  async getLoginOptions(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const credentials = await this.credentialModel
      .find({ userId: user._id })
      .exec();

    if (credentials.length === 0) {
      throw new NotFoundException(
        'Nenhuma credencial biométrica cadastrada neste dispositivo. Use email e senha.',
      );
    }

    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      allowCredentials: credentials.map((c) => ({
        id: c.credentialId,
        transports: c.transports as AuthenticatorTransportFuture[],
      })),
      userVerification: 'preferred',
    });

    // Replace any stale login challenges for this email
    await this.challengeModel
      .deleteMany({ email: user.email, type: 'login' })
      .exec();

    await this.challengeModel.create({
      challenge: options.challenge,
      type: 'login',
      email: user.email,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    return options;
  }

  async verifyLogin(email: string, response: AuthenticationResponseJSON) {
    const stored = await this.challengeModel
      .findOne({ email, type: 'login', expiresAt: { $gt: new Date() } })
      .exec();

    if (!stored) throw new BadRequestException('Desafio inválido ou expirado');

    const credential = await this.credentialModel
      .findOne({ credentialId: response.id })
      .exec();

    if (!credential) throw new UnauthorizedException('Credencial não encontrada');

    const { verified, authenticationInfo } = await verifyAuthenticationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: this.origin,
      expectedRPID: [this.rpID],
      credential: {
        id: credential.credentialId,
        publicKey: Buffer.from(credential.publicKey, 'base64url') as unknown as Uint8Array<ArrayBuffer>,
        counter: credential.counter,
        transports: credential.transports as AuthenticatorTransportFuture[],
      },
      requireUserVerification: false,
    });

    if (!verified) throw new UnauthorizedException('Verificação biométrica falhou');

    await this.credentialModel
      .findByIdAndUpdate(credential._id, { counter: authenticationInfo.newCounter })
      .exec();

    await this.challengeModel.findByIdAndDelete(stored._id).exec();

    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException();

    return this.authService.login({
      _id: user._id as Types.ObjectId,
      email: user.email,
    });
  }

  async listCredentials(userId: string) {
    return this.credentialModel
      .find({ userId: new Types.ObjectId(userId) })
      .select('credentialId deviceType backedUp transports createdAt')
      .exec();
  }

  async deleteCredential(userId: string, credentialId: string) {
    const result = await this.credentialModel
      .deleteOne({ userId: new Types.ObjectId(userId), credentialId })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('Credencial não encontrada');
    }

    return { deleted: true };
  }
}
