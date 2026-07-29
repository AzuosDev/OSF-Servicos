import { BadRequestException, Body, Controller, Get, Headers, Param, Post, RawBodyRequest, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
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
