import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { UsersService } from '../users/users.service';
import { ICurrentUser } from '../../common/types/current-user.type';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

const PIX_PRICE_MONTHLY = 49.9;
const SUBSCRIPTION_DURATION_DAYS = 30;
const PLAN_NAME = 'AkLavajato App';

type CheckoutResult =
  | { url: string }
  | {
      pixData: {
        paymentId: string;
        qrCodeImage: string;
        copyPaste: string;
        expirationDate: string;
      };
    };

@Injectable()
export class BillingService {
  private readonly stripe: Stripe;
  private readonly asaasUrl: string;
  private readonly asaasApiKey: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    this.stripe = new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY') ?? '');
    this.asaasUrl = this.configService.get<string>('ASAAS_URL') ?? 'https://api.asaas.com/v3';
    this.asaasApiKey = this.configService.get<string>('ASAAS_API_KEY') ?? '';
    this.frontendUrl = (this.configService.get<string>('FRONTEND_URL') ?? '').split(',')[0].trim().replace(/\/$/, '');
  }

  private getStripePriceId(): string {
    const priceId = this.configService.get<string>('STRIPE_PRICE_AKLAVAJATO_MONTHLY');
    if (!priceId) {
      throw new BadRequestException('Preço não configurado no servidor');
    }
    return priceId;
  }

  private async asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.asaasUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        access_token: this.asaasApiKey,
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new BadRequestException(`Falha na comunicação com o Asaas: ${body}`);
    }

    return response.json() as Promise<T>;
  }

  private async ensureAsaasCustomer(user: ICurrentUser, cpfCnpj: string): Promise<string> {
    if (user.asaasCustomerId) {
      return user.asaasCustomerId;
    }

    const customer = await this.asaasFetch<{ id: string }>('/customers', {
      method: 'POST',
      body: JSON.stringify({
        name: user.email,
        email: user.email,
        cpfCnpj,
      }),
    });

    await this.usersService.setAsaasCustomerId(user._id.toString(), customer.id);
    return customer.id;
  }

  async createCheckout(user: ICurrentUser, dto: CreateCheckoutDto): Promise<CheckoutResult> {
    const userId = user._id.toString();

    if (dto.method === 'stripe') {
      const priceId = this.getStripePriceId();
      const session = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: user.email,
        success_url: `${this.frontendUrl}/checkout?status=success`,
        cancel_url: `${this.frontendUrl}/checkout?status=cancelled`,
        metadata: { userId, plan: dto.plan },
        subscription_data: { metadata: { userId, plan: dto.plan } },
      });

      if (!session.url) {
        throw new BadRequestException('Não foi possível criar a sessão de pagamento');
      }

      return { url: session.url };
    }

    if (!dto.cpfCnpj) {
      throw new BadRequestException('Informe o CPF/CNPJ para pagamento via PIX');
    }

    const asaasCustomerId = await this.ensureAsaasCustomer(user, dto.cpfCnpj);
    const dueDate = new Date().toISOString().slice(0, 10);

    const payment = await this.asaasFetch<{ id: string }>('/payments', {
      method: 'POST',
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: 'PIX',
        value: PIX_PRICE_MONTHLY,
        dueDate,
        description: `${PLAN_NAME} - Mensal`,
        externalReference: `${userId}__${dto.plan}`,
      }),
    });

    const qrCode = await this.asaasFetch<{ encodedImage: string; payload: string; expirationDate: string }>(
      `/payments/${payment.id}/pixQrCode`,
    );

    return {
      pixData: {
        paymentId: payment.id,
        qrCodeImage: qrCode.encodedImage,
        copyPaste: qrCode.payload,
        expirationDate: qrCode.expirationDate,
      },
    };
  }

  async getPixStatus(user: ICurrentUser, paymentId: string): Promise<{ status: string; active: boolean }> {
    const payment = await this.asaasFetch<{ status: string; externalReference?: string }>(`/payments/${paymentId}`);
    const userId = user._id.toString();

    if (!payment.externalReference || !payment.externalReference.startsWith(`${userId}__`)) {
      throw new ForbiddenException('Cobrança não pertence a este usuário');
    }

    const isConfirmed = payment.status === 'CONFIRMED' || payment.status === 'RECEIVED';

    if (isConfirmed) {
      const [, plan] = payment.externalReference.split('__') as [string, string];
      const subscriptionExpiresAt = new Date(Date.now() + SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000);

      await this.usersService.activateSubscription(userId, {
        plan,
        asaasCustomerId: user.asaasCustomerId ?? undefined,
        subscriptionExpiresAt,
      });
    }

    return { status: payment.status, active: isConfirmed };
  }

  async createPortalSession(user: ICurrentUser): Promise<{ url: string }> {
    if (!user.stripeCustomerId) {
      throw new BadRequestException('Assinatura não gerenciada pelo Stripe');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${this.frontendUrl}/configuracoes`,
    });

    return { url: session.url };
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string): Promise<{ received: true }> {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
    const event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const { userId, plan } = session.metadata ?? {};

      if (userId && plan) {
        await this.usersService.activateSubscription(userId, {
          plan,
          stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
          stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : undefined,
          subscriptionExpiresAt: null,
        });
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      await this.usersService.cancelSubscriptionByStripeSubscriptionId(subscription.id);
    }

    return { received: true };
  }

  async handleAsaasWebhook(body: { event?: string; payment?: { externalReference?: string } }): Promise<{ received: true }> {
    const relevantEvents = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'];

    if (body.event && relevantEvents.includes(body.event) && body.payment?.externalReference) {
      const [userId, plan] = body.payment.externalReference.split('__') as [string, string];

      if (userId && plan) {
        const subscriptionExpiresAt = new Date(Date.now() + SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000);
        await this.usersService.activateSubscription(userId, {
          plan,
          subscriptionExpiresAt,
        });
      }
    }

    return { received: true };
  }
}
