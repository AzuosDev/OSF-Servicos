import { BadRequestException, Body, Controller, Get, Headers, Param, Post, RawBodyRequest, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { PendingCheckoutDto } from './dto/pending-checkout.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ICurrentUser } from '../../common/types/current-user.type';

@ApiTags('Billing')
@Controller('api/billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  async checkout(@CurrentUser() user: ICurrentUser, @Body() dto: CreateCheckoutDto) {
    return this.billingService.createCheckout(user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('pix/:paymentId/status')
  async pixStatus(@CurrentUser() user: ICurrentUser, @Param('paymentId') paymentId: string) {
    return this.billingService.getPixStatus(user, paymentId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('portal')
  async portal(@CurrentUser() user: ICurrentUser) {
    return this.billingService.createPortalSession(user);
  }

  /** Resumo da mensalidade em aberto do usuário logado (mês atual + atrasados). */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('pending')
  async pending(@CurrentUser() user: ICurrentUser) {
    return this.billingService.getPendingSummary(user._id.toString());
  }

  /** Gera um único PIX cobrindo todas as parcelas em aberto do usuário. */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('pending/checkout')
  async pendingCheckout(@CurrentUser() user: ICurrentUser, @Body() dto: PendingCheckoutDto) {
    return this.billingService.createPendingPixCheckout(user, dto.cpfCnpj);
  }

  @SkipThrottle()
  @Post('webhook/stripe')
  async stripeWebhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature: string) {
    if (!req.rawBody || !signature) {
      throw new BadRequestException('Webhook inválido');
    }
    return this.billingService.handleStripeWebhook(req.rawBody, signature);
  }

  @SkipThrottle()
  @Post('webhook/asaas')
  async asaasWebhook(@Body() body: { event?: string; payment?: { externalReference?: string } }) {
    return this.billingService.handleAsaasWebhook(body);
  }
}
