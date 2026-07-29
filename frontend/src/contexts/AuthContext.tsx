import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { api } from "../lib/api";
import type { SubscriptionStatus, User } from "../types/api";

export type Subscription = {
  status: SubscriptionStatus | null;
  plan: string | null;
  trialEndsAt: string | null;
  isLegacyFree: boolean;
  subscriptionExpiresAt: string | null;
  billingCycle: string | null;
};

export function extractSubscription(user: User): Subscription {
  return {
    status: user.subscriptionStatus ?? null,
    plan: user.plan ?? null,
    trialEndsAt: user.trialEndsAt ?? null,
    isLegacyFree: user.isLegacyFree ?? false,
    subscriptionExpiresAt: user.subscriptionExpiresAt ?? null,
    billingCycle: user.billingCycle ?? null,
  };
}

export function computeHasAccess(subscription: Subscription | null): boolean {
  if (!subscription) return false;
  if (subscription.isLegacyFree) return true;

  if (subscription.status === "active") {
    if (!subscription.subscriptionExpiresAt) return true;
    return new Date(subscription.subscriptionExpiresAt).getTime() > Date.now();
  }

  if (subscription.status === "trial") {
    return Boolean(subscription.trialEndsAt) && new Date(subscription.trialEndsAt as string).getTime() > Date.now();
  }

  return false;
}

interface AuthContextValue {
  isLocked: boolean;
  lock: () => void;
  unlock: () => void;
  user: User | null;
  subscription: Subscription | null;
  subscriptionLoaded: boolean;
  hasAccess: boolean;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  isLocked: true,
  lock: () => {},
  unlock: () => {},
  user: null,
  subscription: null,
  subscriptionLoaded: false,
  hasAccess: false,
  refreshMe: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [subscriptionLoaded, setSubscriptionLoaded] = useState(false);
  const lock = useCallback(() => setIsLocked(true), []);
  const unlock = useCallback(() => setIsLocked(false), []);

  const refreshMe = useCallback(async () => {
    try {
      const { data } = await api.get<User>("/api/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setSubscriptionLoaded(true);
    }
  }, []);

  const subscription = useMemo(() => (user ? extractSubscription(user) : null), [user]);
  const hasAccess = useMemo(() => computeHasAccess(subscription), [subscription]);

  return (
    <AuthContext.Provider
      value={{ isLocked, lock, unlock, user, subscription, subscriptionLoaded, hasAccess, refreshMe }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
