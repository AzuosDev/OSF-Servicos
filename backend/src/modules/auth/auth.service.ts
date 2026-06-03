import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RefreshTokenDocument } from './schemas/refresh-token.schema';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectModel('RefreshToken') private refreshModel: Model<RefreshTokenDocument>,
  ) {}

  async register(dto: { email: string; password: string }) {
    const user = await this.usersService.create(dto);
    // enviar email de verificação (stub)
    console.log('Enviar email de verificação para:', user.email);
    return user;
  }

  async verifyEmail(token: string) {
    // procurar usuário com token
    const user = await (this.usersService as any).userModel?.findOneAndUpdate({ emailVerificationToken: token }, { emailVerified: true, emailVerificationToken: null }, { new: true }).select('-password').exec();
    if (!user) throw new UnauthorizedException('Token inválido');
    return user;
  }

  async login(user: any) {
    const payload = { sub: user._id.toString(), email: user.email };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const rawRefresh = crypto.randomBytes(64).toString('hex');
    const hashed = await bcrypt.hash(rawRefresh, 10);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.refreshModel.create({ userId: user._id, token: hashed, expiresAt });
    return { accessToken, refreshToken: rawRefresh };
  }

  async refresh(rawRefreshToken: string) {
    const tokens = await this.refreshModel.find({ expiresAt: { $gt: new Date() } }).exec();
    for (const t of tokens) {
      const ok = await bcrypt.compare(rawRefreshToken, t.token);
      if (ok) {
        const userId = t.userId.toString();
        // rotate
        await this.refreshModel.findByIdAndDelete(t._id).exec();
        const payload = { sub: userId };
        const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
        const newRaw = crypto.randomBytes(64).toString('hex');
        const hashed = await bcrypt.hash(newRaw, 10);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await this.refreshModel.create({ userId, token: hashed, expiresAt });
        return { accessToken, refreshToken: newRaw };
      }
    }
    throw new UnauthorizedException('Refresh token inválido');
  }

  async logout(userId: string, rawRefreshToken: string) {
    const tokens = await this.refreshModel.find({ userId }).exec();
    for (const t of tokens) {
      const ok = await bcrypt.compare(rawRefreshToken, t.token);
      if (ok) {
        await this.refreshModel.findByIdAndDelete(t._id).exec();
        return true;
      }
    }
    return false;
  }

  async forgotPassword(email: string) {
    const token = await this.usersService.setPasswordResetToken(email);
    console.log('Enviar email de reset para:', email, 'token:', token);
    return true;
  }
}
