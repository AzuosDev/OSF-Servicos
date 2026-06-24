import { Body, Controller, Delete, Get, HttpCode, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ICurrentUser } from '../../common/types/current-user.type';
import { UsersService } from './users.service';
import { UpdateNameDto } from './dto/update-name.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('api/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: ICurrentUser) {
    return this.usersService.findById(user._id.toString());
  }

  @Patch('me')
  async updateName(@CurrentUser() user: ICurrentUser, @Body() dto: UpdateNameDto) {
    return this.usersService.updateName(user._id.toString(), dto.name);
  }

  @Patch('me/password')
  @HttpCode(200)
  async changePassword(@CurrentUser() user: ICurrentUser, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(user._id.toString(), dto.currentPassword, dto.newPassword);
  }

  @Patch('me/avatar')
  @HttpCode(200)
  async updateAvatar(
    @CurrentUser() user: ICurrentUser,
    @Body('avatarUrl') avatarUrl: string | null,
  ) {
    return this.usersService.updateAvatar(user._id.toString(), avatarUrl ?? null);
  }

  @Delete('me')
  @HttpCode(200)
  async deleteAccount(@CurrentUser() user: ICurrentUser) {
    return this.usersService.deleteAccount(user._id.toString());
  }
}
