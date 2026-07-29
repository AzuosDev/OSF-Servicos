import { Body, Controller, Delete, Get, Patch, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ICurrentUser } from '../../common/types/current-user.type';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';
import { PushSubscriptionDto } from './dto/push-subscription.dto';
import { RemovePushSubscriptionDto } from './dto/remove-push-subscription.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushService: PushService,
  ) {}

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

  @Get('push/public-key')
  getPushPublicKey() {
    return { publicKey: this.pushService.getPublicKey() };
  }

  @Post('push/subscribe')
  async subscribeToPush(@CurrentUser() user: ICurrentUser, @Body() dto: PushSubscriptionDto) {
    await this.pushService.saveSubscription(user._id, dto);
    return { success: true };
  }

  @Delete('push/subscribe')
  async unsubscribeFromPush(@CurrentUser() user: ICurrentUser, @Body() dto: RemovePushSubscriptionDto) {
    await this.pushService.removeSubscription(user._id, dto.endpoint);
    return { success: true };
  }
}
