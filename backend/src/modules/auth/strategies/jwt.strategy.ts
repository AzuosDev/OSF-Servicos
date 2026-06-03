import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private usersService: UsersService) {
    const secret = process.env.JWT_SECRET || 'dev';
    console.log('JwtStrategy secret:', secret ? '[redacted]' : '[none]');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    console.log('JwtStrategy validate payload:', payload);
    const user = await this.usersService.findById(payload.sub);
    console.log('JwtStrategy user found:', user?._id?.toString());
    return user;
  }
}
