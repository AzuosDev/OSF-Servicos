import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Building2, CreditCard, Fingerprint, Loader2, ShieldCheck, Trash2, AlertCircle } from "lucide-react";
import { startRegistration, platformAuthenticatorIsAvailable } from "@simplewebauthn/browser";

import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { getApiErrorMessages, getApiErrorText } from "../lib/errors";
import { PushNotificationToggle } from "../components/PushNotificationToggle";
import { CurrencyInput } from "../components/ui/CurrencyInput";
import type { BillingPortalResponse, CompanySettings } from "../types/api";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";

type CompanySettingsFormState = {
  companyName: string;
  cnpj: string;
  baseAddress: string;
  originLat: string;
  originLng: string;
  phone: string;
  email: string;
  pricePerKm: number;
  minimumTravelFee: number;
  freeRadiusKm: number;
  pdfFooterNote: string;
};

function emptyCompanySettingsForm(): CompanySettingsFormState {
  return {
    companyName: "",
    cnpj: "",
    baseAddress: "",
    originLat: "",
    originLng: "",
    phone: "",
    email: "",
    pricePerKm: 1.5,
    minimumTravelFee: 0,
    freeRadiusKm: 0,
    pdfFooterNote: "",
  };
}

function CompanySettingsSection() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CompanySettingsFormState>(emptyCompanySettingsForm());
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const settingsQuery = useQuery<CompanySettings | null>({
    queryKey: ["orcamentos-company-settings"],
    queryFn: () => api.get<CompanySettings | null>("/api/orcamentos/company-settings").then((r) => r.data),
  });

  useEffect(() => {
    const settings = settingsQuery.data;
    if (!settings) return;
    setForm({
      companyName: settings.companyName,
      cnpj: settings.cnpj ?? "",
      baseAddress: settings.baseAddress ?? "",
      originLat: settings.originLat != null ? String(settings.originLat) : "",
      originLng: settings.originLng != null ? String(settings.originLng) : "",
      phone: settings.phone ?? "",
      email: settings.email ?? "",
      pricePerKm: settings.pricePerKm,
      minimumTravelFee: settings.minimumTravelFee,
      freeRadiusKm: settings.freeRadiusKm,
      pdfFooterNote: settings.pdfFooterNote ?? "",
    });
  }, [settingsQuery.data]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        companyName: form.companyName.trim(),
        cnpj: form.cnpj.trim() || undefined,
        baseAddress: form.baseAddress.trim() || undefined,
        originLat: form.originLat.trim() ? Number(form.originLat) : undefined,
        originLng: form.originLng.trim() ? Number(form.originLng) : undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        pricePerKm: form.pricePerKm,
        minimumTravelFee: form.minimumTravelFee,
        freeRadiusKm: form.freeRadiusKm,
        pdfFooterNote: form.pdfFooterNote.trim() || undefined,
      };
      const { data } = await api.put<CompanySettings>("/api/orcamentos/company-settings", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orcamentos-company-settings"] });
      setSaved(true);
    },
  });

  return (
    <div className="rounded-2xl bg-bg-card p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Building2 className="h-5 w-5 text-accent-gold shrink-0" />
        <div>
          <h2 className="font-semibold text-text-primary">Dados da empresa (Orçamentos)</h2>
          <p className="text-xs text-text-secondary">
            Endereço de partida e preço por km usados no cálculo de deslocamento dos orçamentos.
          </p>
        </div>
      </div>

      {settingsQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setSaved(false);

            const hasAddress = Boolean(form.baseAddress.trim());
            const hasCoords = Boolean(form.originLat.trim() && form.originLng.trim());
            if (!hasAddress && !hasCoords) {
              setFormError(
                "Informe o endereço de partida ou as coordenadas (latitude e longitude).",
              );
              return;
            }
            setFormError(null);
            mutation.mutate();
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm text-text-secondary">Nome da empresa</span>
            <input
              type="text"
              maxLength={150}
              required
              value={form.companyName}
              onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
              className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-text-secondary">
              Endereço de partida (opcional se preencher as coordenadas)
            </span>
            <input
              type="text"
              maxLength={300}
              placeholder="Endereço usado quando não houver coordenadas abaixo"
              value={form.baseAddress}
              onChange={(e) => setForm((f) => ({ ...f, baseAddress: e.target.value }))}
              className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm text-text-secondary">
                Latitude {form.baseAddress.trim() ? "(opcional)" : ""}
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Ex.: -3.316806"
                value={form.originLat}
                onChange={(e) => setForm((f) => ({ ...f, originLat: e.target.value }))}
                className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-text-secondary">
                Longitude {form.baseAddress.trim() ? "(opcional)" : ""}
              </span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Ex.: -40.093"
                value={form.originLng}
                onChange={(e) => setForm((f) => ({ ...f, originLng: e.target.value }))}
                className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold"
              />
            </label>
          </div>
          <p className="-mt-2 text-xs text-text-secondary">
            Preencha ao menos um dos dois: o endereço ou as coordenadas. Quando as coordenadas estiverem
            preenchidas, elas são usadas no lugar do endereço para o cálculo de deslocamento.
          </p>
          {formError && <p className="-mt-2 text-xs text-accent-red">{formError}</p>}

          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm text-text-secondary">R$ / km (ida e volta)</span>
              <CurrencyInput
                value={form.pricePerKm}
                onChange={(v) => setForm((f) => ({ ...f, pricePerKm: v }))}
                className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-text-secondary">Taxa mínima</span>
              <CurrencyInput
                value={form.minimumTravelFee}
                onChange={(v) => setForm((f) => ({ ...f, minimumTravelFee: v }))}
                className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-text-secondary">Raio grátis (km)</span>
              <input
                type="number"
                min={0}
                step="0.1"
                value={form.freeRadiusKm}
                onChange={(e) => setForm((f) => ({ ...f, freeRadiusKm: Number(e.target.value) || 0 }))}
                className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm text-text-secondary">Observação no rodapé do PDF (opcional)</span>
            <textarea
              maxLength={1000}
              rows={2}
              value={form.pdfFooterNote}
              onChange={(e) => setForm((f) => ({ ...f, pdfFooterNote: e.target.value }))}
              className="w-full resize-none rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold"
            />
          </label>

          {mutation.isError && (
            <div className="rounded-xl bg-accent-red/10 p-3 text-sm text-accent-red">
              {getApiErrorMessages(mutation.error, "Não foi possível salvar os dados da empresa.").map((m) => (
                <p key={m}>{m}</p>
              ))}
            </div>
          )}

          {saved && !mutation.isPending && (
            <p className="text-xs text-accent-gold">Dados da empresa salvos com sucesso.</p>
          )}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-gold px-4 py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar dados da empresa
          </button>
        </form>
      )}
    </div>
  );
}

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
            <CreditCard className="h-5 w-5 text-accent-gold shrink-0" />
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

      {/* Seção dados da empresa (Orçamentos) */}
      <CompanySettingsSection />

      {/* Seção notificações push */}
      <div className="rounded-2xl bg-bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-accent-gold shrink-0" />
          <div>
            <h2 className="font-semibold text-text-primary">Notificações push</h2>
            <p className="text-xs text-text-secondary">
              Avisos de contas vencendo e serviços pendentes mesmo com o app fechado.
            </p>
          </div>
        </div>

        <PushNotificationToggle />
      </div>

      {/* Seção biometria */}
      <div className="rounded-2xl bg-bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Fingerprint className="h-5 w-5 text-accent-gold shrink-0" />
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
                      <ShieldCheck className="h-4 w-4 text-accent-gold shrink-0" />
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
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-bg-muted px-4 py-2.5 text-sm text-text-secondary transition hover:border-accent-gold/50 hover:text-text-primary disabled:opacity-50"
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
                  <div className="flex items-center gap-2 rounded-xl bg-accent-gold/10 px-4 py-3 text-sm text-accent-gold">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    Biometria ativada com sucesso!
                  </div>
                ) : (
                  <button
                    onClick={() => registerMutation.mutate()}
                    disabled={registerMutation.isPending}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-gold px-4 py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-50"
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
