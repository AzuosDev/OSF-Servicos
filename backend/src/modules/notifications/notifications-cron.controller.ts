import { Controller, Get, Query, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { NotificationsCronService } from './notifications-cron.service';

/**
 * Endpoint público (sem JWT) para ser chamado por um serviço externo de
 * cron-jobs (ex.: cron-job.org) algumas vezes ao dia. Protegido por um
 * token simples via query string, comparado com NOTIFICATIONS_CRON_TOKEN.
 */
@Controller('api/notifications/cron')
export class NotificationsCronController {
  constructor(
    private readonly notificationsCronService: NotificationsCronService,
    private readonly configService: ConfigService,
  ) {}

  @SkipThrottle()
  @Get('check')
  async check(@Query('token') token?: string) {
    const expectedToken = this.configService.get<string>('NOTIFICATIONS_CRON_TOKEN');

    if (!expectedToken || token !== expectedToken) {
      throw new UnauthorizedException('Token inválido');
    }

    return this.notificationsCronService.generateGlobalNotifications();
  }
}
