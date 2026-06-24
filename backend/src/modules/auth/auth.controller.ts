import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards, Req, HttpCode } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LocalAuthGuard } from '../../common/guards/local-auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ICurrentUser } from '../../common/types/current-user.type';

interface RequestWithUser extends Request {
  user: ICurrentUser;
}

@ApiTags('Auth')
@ApiBearerAuth()
@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Throttle(5, 60)
  @Post('register')
  @HttpCode(201)
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto);
    return user;
  }

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Throttle(5, 60)
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Req() req: RequestWithUser) {
    const user = req.user;
    return this.authService.login(user);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: RequestWithUser, @Body() dto: RefreshTokenDto) {
    const user = req.user;
    await this.authService.logout(user._id.toString(), dto.refreshToken);
    return { ok: true };
  }

  @Throttle(5, 60)
  @Post('forgot-password')
  async forgot(@Body() body: { email: string }) {
    await this.authService.forgotPassword(body.email);
    return { ok: true };
  }

  @Post('reset-password')
  async reset(@Body() dto: ResetPasswordDto) {
    const nextPassword = dto.newPassword ?? dto.password;

    if (!nextPassword) {
      throw new BadRequestException('Informe a nova senha');
    }

    return this.authService.resetPassword(dto.token, nextPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: RequestWithUser) {
    const user = req.user;
    return user;
  }
}
