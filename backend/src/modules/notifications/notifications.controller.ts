import { Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ICurrentUser } from '../../common/types/current-user.type';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getUnread(@CurrentUser() user: ICurrentUser) {
    return this.notificationsService.findUnreadByUser(user._id);
  }

  @Patch('read-all')
  async markAllRead(@CurrentUser() user: ICurrentUser) {
    await this.notificationsService.markAllAsRead(user._id);
    return { success: true };
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    await this.notificationsService.markAsRead(id, user._id);
    return { success: true };
  }
}
