import { Types } from 'mongoose';

export interface ICurrentUser {
  _id: Types.ObjectId;
  email: string;
  emailVerified: boolean;
  subscriptionStatus?: 'trial' | 'active' | 'expired' | 'cancelled' | null;
  plan?: string | null;
  trialEndsAt?: Date | null;
  isLegacyFree?: boolean;
  cpfCnpj?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  asaasCustomerId?: string | null;
  subscriptionExpiresAt?: Date | null;
  billingCycle?: string | null;
}
