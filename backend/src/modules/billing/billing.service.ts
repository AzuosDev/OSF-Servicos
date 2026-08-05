import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import Stripe from 'stripe';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ICurrentUser } from '../../common/types/current-user.type';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { Invoice, InvoiceDocument } from './schemas/invoice.schema';

const PIX_PRICE_MONTHLY = 49.9;
const SUBSCRIPTION_DURATION_DAYS = 30;
const PLAN_NAME = 'AkLavajato App';
/** Todo mês, a mensalidade é gerada e vence no dia 28. */
const BILLING_DAY = 28;

export type PixCheckoutData = {
  paymentId: string;
  qrCodeImage: string;
  copyPaste: string;
  expirationDate: string;
};

export type PendingBillingSummary = {
  hasPending: boolean;
  totalAmount: number;
  installments: number;
  invoices: { referenceMonth: string; amount: number; dueDate: Date }[];
};

type CheckoutResult = { url: string } | { pixData: PixCheckoutData };

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe;
  private readonly asaasUrl: string;
  private readonly asaasApiKey: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
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
      const [, marker] = payment.externalReference.split('__') as [string, string];

      if (marker === 'pending') {
        await this.settlePendingInvoices(userId, paymentId);
      } else {
        const subscriptionExpiresAt = new Date(Date.now() + SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000);
        await this.usersService.activateSubscription(userId, {
          plan: marker,
          asaasCustomerId: user.asaasCustomerId ?? undefined,
          subscriptionExpiresAt,
        });
      }
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

  async handleAsaasWebhook(
    body: { event?: string; payment?: { id?: string; externalReference?: string } },
  ): Promise<{ received: true }> {
    const relevantEvents = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'];

    if (body.event && relevantEvents.includes(body.event) && body.payment?.externalReference) {
      const [userId, marker] = body.payment.externalReference.split('__') as [string, string];

      if (userId && marker === 'pending' && body.payment.id) {
        await this.settlePendingInvoices(userId, body.payment.id);
      } else if (userId && marker) {
        const subscriptionExpiresAt = new Date(Date.now() + SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000);
        await this.usersService.activateSubscription(userId, {
          plan: marker,
          subscriptionExpiresAt,
        });
      }
    }

    return { received: true };
  }

  // ─── Mensalidade recorrente (dia 28, cumulativa, sem bloqueio de acesso) ────

  private referenceMonthOf(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private dueDateFor(referenceMonth: string): Date {
    const [year, month] = referenceMonth.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, BILLING_DAY));
  }

  /**
   * Gera a mensalidade do mês corrente para todo usuário elegível que ainda não
   * tem uma parcela desse mês. Idempotente: pode ser chamado várias vezes no
   * mesmo dia 28 (ex.: cron externo batendo mais de uma vez) sem duplicar.
   */
  async generateMonthlyInvoices(referenceDate: Date = new Date()): Promise<{ created: number; eligible: number }> {
    const referenceMonth = this.referenceMonthOf(referenceDate);
    const dueDate = this.dueDateFor(referenceMonth);

    const eligibleUsers = await this.usersService.findEligibleForBilling(referenceDate);
    if (eligibleUsers.length === 0) {
      return { created: 0, eligible: 0 };
    }

    const eligibleIds = eligibleUsers.map((u) => u._id as Types.ObjectId);
    const alreadyBilled = await this.invoiceModel
      .find({ referenceMonth, userId: { $in: eligibleIds } })
      .select('userId')
      .lean()
      .exec();
    const alreadyBilledIds = new Set(alreadyBilled.map((inv) => (inv.userId as Types.ObjectId).toString()));

    const toCreate = eligibleIds
      .filter((id) => !alreadyBilledIds.has(id.toString()))
      .map((userId) => ({ userId, referenceMonth, amount: PIX_PRICE_MONTHLY, status: 'pending' as const, dueDate }));

    if (toCreate.length > 0) {
      await this.invoiceModel.insertMany(toCreate, { ordered: false });
    }

    this.logger.log(`Mensalidade ${referenceMonth}: ${toCreate.length} nova(s) parcela(s) de ${eligibleUsers.length} usuário(s) elegível(is)`);
    return { created: toCreate.length, eligible: eligibleUsers.length };
  }

  /** Soma de todas as parcelas em aberto do usuário — cumulativo entre meses não pagos. */
  async getPendingSummary(userId: string): Promise<PendingBillingSummary> {
    const invoices = await this.invoiceModel
      .find({ userId: new Types.ObjectId(userId), status: 'pending' })
      .sort({ referenceMonth: 1 })
      .lean()
      .exec();

    const totalAmount = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);

    return {
      hasPending: invoices.length > 0,
      totalAmount,
      installments: invoices.length,
      invoices: invoices.map((invoice) => ({
        referenceMonth: invoice.referenceMonth,
        amount: invoice.amount,
        dueDate: invoice.dueDate,
      })),
    };
  }

  /**
   * Chamado a cada login (best-effort, ver AuthService). Mantém o sininho de
   * notificações sincronizado com o saldo em aberto: cria/reabre o lembrete
   * quando há pendência, remove quando está tudo quitado.
   */
  async checkAndNotifyPendingBilling(userId: Types.ObjectId): Promise<void> {
    const summary = await this.getPendingSummary(userId.toString());

    if (summary.hasPending) {
      await this.notificationsService.upsertBillingReminderNotification({
        userId,
        totalAmount: summary.totalAmount,
        installments: summary.installments,
      });
    } else {
      await this.notificationsService.removeBillingReminderNotification(userId);
    }
  }

  /** Gera um único PIX cobrindo TODAS as parcelas em aberto do usuário (mês atual + atrasados). */
  async createPendingPixCheckout(user: ICurrentUser, cpfCnpj?: string): Promise<PixCheckoutData> {
    const userId = user._id.toString();
    const pendingInvoices = await this.invoiceModel.find({ userId: user._id, status: 'pending' }).exec();

    if (pendingInvoices.length === 0) {
      throw new BadRequestException('Não há mensalidade pendente para este usuário.');
    }

    if (!user.asaasCustomerId && !cpfCnpj) {
      throw new BadRequestException('Informe o CPF/CNPJ para pagamento via PIX');
    }

    const totalAmount = pendingInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
    const asaasCustomerId = await this.ensureAsaasCustomer(user, cpfCnpj ?? '');
    const dueDate = new Date().toISOString().slice(0, 10);
    const referenceMonths = pendingInvoices.map((invoice) => invoice.referenceMonth).join(', ');

    const payment = await this.asaasFetch<{ id: string }>('/payments', {
      method: 'POST',
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: 'PIX',
        value: totalAmount,
        dueDate,
        description:
          pendingInvoices.length > 1
            ? `${PLAN_NAME} - Mensalidades acumuladas (${referenceMonths})`
            : `${PLAN_NAME} - Mensal (${referenceMonths})`,
        externalReference: `${userId}__pending`,
      }),
    });

    const qrCode = await this.asaasFetch<{ encodedImage: string; payload: string; expirationDate: string }>(
      `/payments/${payment.id}/pixQrCode`,
    );

    await this.invoiceModel
      .updateMany(
        { _id: { $in: pendingInvoices.map((invoice) => invoice._id) } },
        { $set: { asaasPaymentId: payment.id } },
      )
      .exec();

    return {
      paymentId: payment.id,
      qrCodeImage: qrCode.encodedImage,
      copyPaste: qrCode.payload,
      expirationDate: qrCode.expirationDate,
    };
  }

  /** Baixa todas as parcelas vinculadas a esse pagamento e limpa o lembrete. */
  private async settlePendingInvoices(userId: string, paymentId: string): Promise<void> {
    const userObjectId = new Types.ObjectId(userId);
    await this.invoiceModel
      .updateMany(
        { userId: userObjectId, asaasPaymentId: paymentId, status: 'pending' },
        { $set: { status: 'paid', paidAt: new Date() } },
      )
      .exec();
    await this.notificationsService.removeBillingReminderNotification(userObjectId);
  }
}
