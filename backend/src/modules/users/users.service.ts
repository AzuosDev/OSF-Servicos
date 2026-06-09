import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UserDocument, User } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(dto: { email: string; password: string }) {
    const hashed = await bcrypt.hash(dto.password, 12);
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const created = await this.userModel.create({
      email: dto.email,
      password: hashed,
      emailVerified: false,
      emailVerificationToken,
    });
    const obj: any = created.toObject();
    delete obj.password;
    delete obj.passwordResetToken;
    delete obj.passwordResetExpires;
    return obj;
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email }).exec();
  }

  async findById(id: string) {
    const doc = await this.userModel.findById(id).select('-password').exec();
    if (!doc) throw new NotFoundException('User not found');
    return doc;
  }

  async markEmailVerified(userId: string) {
    return this.userModel.findByIdAndUpdate(userId, { emailVerified: true, emailVerificationToken: null }, { new: true }).select('-password').exec();
  }

  async markEmailVerifiedByToken(token: string) {
    return this.userModel.findOneAndUpdate({ emailVerificationToken: token }, { emailVerified: true, emailVerificationToken: null }, { new: true }).select('-password').exec();
  }

  async setPasswordResetToken(email: string) {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    const user = await this.userModel.findOneAndUpdate({ email }, { passwordResetToken: token, passwordResetExpires: expires }, { new: true }).exec();
    if (!user) throw new NotFoundException('User not found');
    return token;
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.userModel.findOne({ passwordResetToken: token, passwordResetExpires: { $gt: new Date() } }).exec();
    if (!user) throw new NotFoundException('Token inválido ou expirado');
    const hashed = await bcrypt.hash(newPassword, 12);
    user.password = hashed as any;
    user.passwordResetToken = undefined as any;
    user.passwordResetExpires = undefined as any;
    await user.save();
    const obj: any = user.toObject();
    delete obj.password;
    return obj;
  }
}
