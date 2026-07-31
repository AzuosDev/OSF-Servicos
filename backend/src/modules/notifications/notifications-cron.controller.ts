import { Controller, Get, Query, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { NotificationsCronService } from './notifications-cron.service';
import { PushService } from './push.service';

/**
 * Endpoint público (sem JWT) para ser chamado por um serviço externo de
 * cron-jobs (ex.: cron-job.org) algumas vezes ao dia. Protegido por um
 * token simples via query string, comparado com NOTIFICATIONS_CRON_TOKEN.
 */
@Controller('api/notifications/cron')
export class NotificationsCronController {
  constructor(
    private readonly notificationsCronService: NotificationsCronService,
    private readonly pushService: PushService,
    private readonly configService: ConfigService,
  ) {}

  private assertValidToken(token?: string) {
    const expectedToken = this.configService.get<string>('NOTIFICATIONS_CRON_TOKEN');
    if (!expectedToken || token !== expectedToken) {
      throw new UnauthorizedException('Token inválido');
    }
  }

  @SkipThrottle()
  @Get('check')
  async check(@Query('token') token?: string) {
    this.assertValidToken(token);
    return this.notificationsCronService.generateGlobalNotifications();
  }

  /** Dispara um push de teste para TODAS as inscrições cadastradas, sem nenhum critério de negócio — só para validar se o pipeline (VAPID, service worker, etc.) está funcionando de ponta a ponta. */
  @SkipThrottle()
  @Get('test-push')
  async testPush(@Query('token') token?: string) {
    this.assertValidToken(token);
    const sent = await this.pushService.sendToAllSubscribed({
      title: 'AK LavaJato',
      body: 'Notificação de teste — se você recebeu isso, o push está funcionando! 🎉',
    });
    return { subscriptionsNotified: sent };
  }
}
