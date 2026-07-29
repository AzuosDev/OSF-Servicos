import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as webpush from 'web-push';
import { PushSubscription, PushSubscriptionDocument } from './schemas/push-subscription.schema';

export type PushPayload = { title: string; body: string };

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly vapidConfigured: boolean;

  constructor(
    @InjectModel(PushSubscription.name)
    private readonly subscriptionModel: Model<PushSubscriptionDocument>,
    private readonly configService: ConfigService,
  ) {
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.configService.get<string>('VAPID_SUBJECT') ?? 'mailto:contato@aklavajato.com.br';

    this.vapidConfigured = Boolean(publicKey && privateKey);
    if (this.vapidConfigured) {
      webpush.setVapidDetails(subject, publicKey as string, privateKey as string);
    } else {
      this.logger.warn('VAPID keys not configured — push notifications are disabled.');
    }
  }

  getPublicKey(): string | null {
    return this.configService.get<string>('VAPID_PUBLIC_KEY') ?? null;
  }

  async saveSubscription(
    userId: Types.ObjectId,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    await this.subscriptionModel
      .findOneAndUpdate(
        { endpoint: subscription.endpoint },
        {
          userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
        { upsert: true },
      )
      .exec();
  }

  async removeSubscription(userId: Types.ObjectId, endpoint: string) {
    await this.subscriptionModel.deleteOne({ userId, endpoint }).exec();
  }

  async sendToUser(userId: Types.ObjectId, payload: PushPayload) {
    if (!this.vapidConfigured) return;

    const subscriptions = await this.subscriptionModel.find({ userId }).exec();
    await Promise.all(subscriptions.map((subscription) => this.sendToSubscription(subscription, payload)));
  }

  private async sendToSubscription(subscription: PushSubscriptionDocument, payload: PushPayload) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload),
      );
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await this.subscriptionModel.deleteOne({ _id: subscription._id }).exec();
        return;
      }
      this.logger.error('Falha ao enviar push notification', err as Error);
    }
  }
}
