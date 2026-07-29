import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Fingerprint, ShieldCheck, Trash2, Loader2, AlertCircle } from "lucide-react";
import { startRegistration, platformAuthenticatorIsAvailable } from "@simplewebauthn/browser";

import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { getApiErrorText } from "../lib/errors";
import type { BillingPortalResponse } from "../types/api";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";

const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  trial: "Período de teste",
  active: "Ativa",
  expired: "Expirada",
  cancelled: "Cancelada",
};

function formatDateBR(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

type StoredCredential = {
  credentialId: string;
  deviceType?: string;
  backedUp: boolean;
  transports: string[];
  createdAt: string;
};

function useWebAuthnSupported() {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    platformAuthenticatorIsAvailable().then(setSupported).catch(() => setSupported(false));
  }, []);
  return supported;
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const supported = useWebAuthnSupported();
  const { user, subscription } = useAuth();
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const portalMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<BillingPortalResponse>("/api/billing/portal");
      return data;
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error) => {
      setPortalError(getApiErrorText(error, "Não foi possível abrir o portal de assinatura."));
    },
  });

  const credentialsQuery = useQuery<StoredCredential[]>({
    queryKey: ["webauthn-credentials"],
    queryFn: async () => {
      const { data } = await api.get<StoredCredential[]>("/api/auth/webauthn/credentials");
      return data;
    },
  });

  const credentials = credentialsQuery.data ?? [];
  const hasCredential = credentials.length > 0;

  const registerMutation = useMutation({
    mutationFn: async () => {
      const { data: options } = await api.post<PublicKeyCredentialCreationOptionsJSON>(
        "/api/auth/webauthn/register/options",
      );

      const regResponse = await startRegistration({ optionsJSON: options });

      await api.post("/api/auth/webauthn/register/verify", regResponse);
    },
    onSuccess: () => {
      setRegisterError(null);
      setRegisterSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["webauthn-credentials"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if ((err as { name?: string })?.name === "NotAllowedError") {
        setRegisterError("Operação cancelada ou não permitida pelo dispositivo.");
      } else {
        setRegisterError(msg ?? "Erro ao ativar biometria. Tente novamente.");
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (credentialId: string) => {
      await api.delete(`/api/auth/webauthn/credentials/${encodeURIComponent(credentialId)}`);
    },
    onSuccess: () => {
      setDeleteError(null);
      setRegisterSuccess(false);
      queryClient.invalidateQueries({ queryKey: ["webauthn-credentials"] });
    },
    onError: () => setDeleteError("Erro ao remover credencial."),
  });

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <section className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-sans text-2xl font-bold text-text-primary">Configurações</h1>
        <p className="mt-1 text-sm text-text-secondary">Gerencie sua conta e segurança.</p>
      </div>

      {/* Seção assinatura */}
      {subscription && (
        <div className="rounded-2xl bg-bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-accent-lime shrink-0" />
            <div>
              <h2 className="font-semibold text-text-primary">Assinatura</h2>
              <p className="text-xs text-text-secondary">
                {subscription.plan ?? "AkLavajato App"} · {SUBSCRIPTION_STATUS_LABEL[subscription.status ?? ""] ?? "Sem assinatura"}
              </p>
            </div>
          </div>

          {subscription.status === "trial" && subscription.trialEndsAt && (
            <p className="text-sm text-text-secondary">
              Seu período de teste termina em {formatDateBR(subscription.trialEndsAt)}.
            </p>
          )}

          {subscription.status === "active" && (
            <p className="text-sm text-text-secondary">
              Plano mensal
              {subscription.subscriptionExpiresAt
                ? ` · renova em ${formatDateBR(subscription.subscriptionExpiresAt)}`
                : " · renovação automática"}
            </p>
          )}

          {(subscription.status === "expired" || subscription.status === "cancelled") && (
            <p className="text-sm text-text-secondary">Sua assinatura não está ativa no momento.</p>
          )}

          {user?.stripeCustomerId ? (
            <button
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-default bg-bg-muted px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-bg-overlay disabled:opacity-50"
            >
              {portalMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Abrindo...</>
              ) : (
                "Gerenciar assinatura"
              )}
            </button>
          ) : (
            subscription.status !== "trial" && (
              <p className="text-xs text-text-secondary">
                Assinatura via PIX — para trocar o método de pagamento, gere um novo checkout.
              </p>
            )
          )}

          {portalError && <p className="text-xs text-accent-red">{portalError}</p>}
        </div>
      )}

      {/* Seção biometria */}
      <div className="rounded-2xl bg-bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Fingerprint className="h-5 w-5 text-accent-lime shrink-0" />
          <div>
            <h2 className="font-semibold text-text-primary">Login com biometria</h2>
            <p className="text-xs text-text-secondary">
              Face ID, digital ou PIN do dispositivo como alternativa ao email e senha.
            </p>
          </div>
        </div>

        {/* Sem suporte */}
        {supported === false && (
          <div className="flex items-start gap-2 rounded-xl bg-bg-muted px-4 py-3 text-sm text-text-secondary">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            Este dispositivo ou navegador não suporta login biométrico.
          </div>
        )}

        {/* Suportado */}
        {supported === true && (
          <>
            {/* Lista de credenciais */}
            {credentialsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : hasCredential ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                  Dispositivos registrados
                </p>
                {credentials.map((c) => (
                  <div
                    key={c.credentialId}
                    className="flex items-center justify-between rounded-xl bg-bg-muted px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="h-4 w-4 text-accent-lime shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {c.deviceType === "multiDevice" ? "Passkey sincronizado" : "Dispositivo único"}
                        </p>
                        <p className="text-xs text-text-secondary">
                          Cadastrado em {formatDate(c.createdAt)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteMutation.mutate(c.credentialId)}
                      disabled={deleteMutation.isPending}
                      className="rounded-lg p-2 text-text-secondary transition hover:bg-bg-overlay hover:text-accent-red disabled:opacity-50"
                      title="Remover"
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                ))}
                {deleteError && (
                  <p className="text-xs text-accent-red">{deleteError}</p>
                )}

                {/* Adicionar outro dispositivo */}
                <button
                  onClick={() => { setRegisterSuccess(false); registerMutation.mutate(); }}
                  disabled={registerMutation.isPending}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-bg-muted px-4 py-2.5 text-sm text-text-secondary transition hover:border-accent-lime/50 hover:text-text-primary disabled:opacity-50"
                >
                  {registerMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Aguardando biometria...</>
                  ) : (
                    <>+ Adicionar outro dispositivo</>
                  )}
                </button>
              </div>
            ) : (
              <>
                {registerSuccess ? (
                  <div className="flex items-center gap-2 rounded-xl bg-accent-lime/10 px-4 py-3 text-sm text-accent-lime">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    Biometria ativada com sucesso!
                  </div>
                ) : (
                  <button
                    onClick={() => registerMutation.mutate()}
                    disabled={registerMutation.isPending}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-lime px-4 py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-50"
                  >
                    {registerMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Aguardando biometria...</>
                    ) : (
                      <><Fingerprint className="h-4 w-4" /> Ativar login com biometria</>
                    )}
                  </button>
                )}
              </>
            )}

            {registerError && (
              <p className="text-xs text-accent-red">{registerError}</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
