import { Controller, Get, Query, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { BillingService } from './billing.service';

/**
 * Endpoint público (sem JWT) para ser chamado por um serviço externo de
 * cron-jobs (ex.: cron-job.org) todo dia 28. Protegido por um token simples
 * via query string, comparado com BILLING_CRON_TOKEN — mesmo padrão do
 * NotificationsCronController.
 */
@Controller('api/billing/cron')
export class BillingCronController {
  constructor(
    private readonly billingService: BillingService,
    private readonly configService: ConfigService,
  ) {}

  @SkipThrottle()
  @Get('generate-monthly-invoices')
  async generateMonthlyInvoices(@Query('token') token?: string) {
    const expectedToken = this.configService.get<string>('BILLING_CRON_TOKEN');
    if (!expectedToken || token !== expectedToken) {
      throw new UnauthorizedException('Token inválido');
    }
    return this.billingService.generateMonthlyInvoices();
  }
}
