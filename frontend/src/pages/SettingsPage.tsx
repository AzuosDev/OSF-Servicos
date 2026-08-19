import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  Building2,
  Camera,
  Check,
  CreditCard,
  Fingerprint,
  Globe,
  KeyRound,
  Loader2,
  LogOut,
  Moon,
  Settings as SettingsIcon,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  User as UserIcon,
  X,
} from "lucide-react";
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";

import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { clearTokens, getRefreshToken } from "../lib/auth";
import { useTheme } from "../hooks/useTheme";
import { getApiErrorMessages, getApiErrorText } from "../lib/errors";
import { PushNotificationToggle } from "../components/PushNotificationToggle";
import { CurrencyInput } from "../components/ui/CurrencyInput";
import type { BillingPortalResponse, CompanySettings, User } from "../types/api";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";

const inputClass =
  "w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold";

function SettingsCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: typeof UserIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-bg-card p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-accent-gold shrink-0" />
        <div>
          <h2 className="font-semibold text-text-primary">{title}</h2>
          {description && <p className="text-xs text-text-secondary">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

type CompanySettingsFormState = {
  companyName: string;
  cnpj: string;
  baseAddress: string;
  originLat: string;
  originLng: string;
  phone: string;
  email: string;
  instagram: string;
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
    instagram: "",
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
      instagram: settings.instagram ?? "",
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
        instagram: form.instagram.trim() || undefined,
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

          {/* Contatos impressos no cabeçalho do PDF do orçamento. */}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-sm text-text-secondary">Telefone (opcional)</span>
              <input
                type="text"
                maxLength={30}
                placeholder="Ex.: 88 9688-6607"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-text-secondary">E-mail (opcional)</span>
              <input
                type="email"
                maxLength={150}
                placeholder="Ex.: osfenergia.solucoes@gmail.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-text-secondary">Instagram (opcional)</span>
              <input
                type="text"
                maxLength={100}
                placeholder="Ex.: @osf_servicos"
                value={form.instagram}
                onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))}
                className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold"
              />
            </label>
          </div>
          <p className="-mt-2 text-xs text-text-secondary">
            Esses contatos aparecem no cabeçalho do PDF do orçamento. Cada um só é impresso se estiver preenchido.
          </p>

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

// ─── Perfil (avatar + nome) ─────────────────────────────────────────────────

const nameSchema = z.object({ name: z.string().max(100, "Use até 100 caracteres.") });
type NameValues = z.infer<typeof nameSchema>;

function compressImage(file: File, maxSize = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ({ target }) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) { height = Math.round((height * maxSize) / width); width = maxSize; }
        } else {
          if (height > maxSize) { width = Math.round((width * maxSize) / height); height = maxSize; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("canvas not supported")); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ProfileSection() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imgError, setImgError] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [hasGravatar, setHasGravatar] = useState<boolean | null>(null);
  const [nameSaved, setNameSaved] = useState(false);

  const userQuery = useQuery<User>({
    queryKey: ["user-profile"],
    queryFn: () => api.get<User>("/api/users/me").then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });

  const user = userQuery.data;
  const email = user?.email ?? "";
  const avatarUrl = user?.avatarUrl;
  const gravatarUrl = user?.gravatarUrl;
  const initial = (user?.name || email).charAt(0).toUpperCase();

  useEffect(() => setImgError(false), [avatarUrl]);

  useEffect(() => {
    if (!gravatarUrl) return;
    setHasGravatar(null);
    const img = new Image();
    img.onload = () => setHasGravatar(true);
    img.onerror = () => setHasGravatar(false);
    img.src = gravatarUrl.replace("d=mp", "d=404");
  }, [gravatarUrl]);

  const nameForm = useForm<NameValues>({
    resolver: zodResolver(nameSchema),
    values: { name: user?.name ?? "" },
  });

  const updateAvatarMutation = useMutation({
    mutationFn: (url: string | null) =>
      api.patch<User>("/api/users/me/avatar", { avatarUrl: url }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      setUploadError(null);
    },
    onError: (error) => setUploadError(getApiErrorMessages(error, "Erro ao salvar imagem.").join(" ")),
  });

  const updateNameMutation = useMutation({
    mutationFn: (data: NameValues) => api.patch<User>("/api/users/me", data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2500);
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("Selecione um arquivo de imagem válido.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("A imagem deve ter menos de 10 MB.");
      return;
    }
    setUploadError(null);
    try {
      updateAvatarMutation.mutate(await compressImage(file));
    } catch {
      setUploadError("Não foi possível processar a imagem.");
    }
  };

  return (
    <SettingsCard title="Perfil" description="Sua foto e nome de exibição no app." icon={UserIcon}>
      <div className="flex flex-col items-center gap-3">
        <div className="group relative">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={updateAvatarMutation.isPending}
            className="relative block overflow-hidden rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
            aria-label="Alterar foto de perfil"
          >
            {avatarUrl && !imgError ? (
              <img
                src={avatarUrl}
                alt={user?.name || email}
                className="h-20 w-20 rounded-full object-cover ring-4 ring-accent-gold/20"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="grid h-20 w-20 place-items-center rounded-full bg-bg-muted text-3xl font-bold text-accent-gold ring-4 ring-accent-gold/20">
                {userQuery.isLoading ? <Loader2 className="h-6 w-6 animate-spin text-text-muted" /> : initial || "?"}
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition group-hover:opacity-100">
              <Camera className="h-6 w-6 text-white" />
            </div>
          </button>
          {updateAvatarMutation.isPending && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          )}
        </div>

        {userQuery.isLoading ? (
          <div className="h-4 w-40 animate-pulse rounded bg-bg-muted" />
        ) : (
          <p className="text-sm text-text-secondary">{email}</p>
        )}

        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={updateAvatarMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg bg-bg-muted px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            Carregar foto
          </button>
          <button
            type="button"
            onClick={() => gravatarUrl && updateAvatarMutation.mutate(gravatarUrl)}
            disabled={updateAvatarMutation.isPending || hasGravatar !== true}
            className="flex items-center gap-1.5 rounded-lg bg-bg-muted px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary disabled:opacity-50"
            title={
              hasGravatar === null
                ? "Verificando Gravatar..."
                : hasGravatar
                  ? "Usar a foto do seu perfil Gravatar (gravatar.com)"
                  : "Nenhuma foto encontrada no Gravatar com este e-mail"
            }
          >
            <Globe className="h-3.5 w-3.5" />
            {hasGravatar === null ? "Verificando..." : "Usar Gravatar"}
          </button>
          {avatarUrl && (
            <button
              type="button"
              onClick={() => updateAvatarMutation.mutate(null)}
              disabled={updateAvatarMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-bg-muted px-3 py-1.5 text-xs font-medium text-accent-red transition hover:bg-accent-red/10 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
              Remover foto
            </button>
          )}
        </div>

        {uploadError && <p className="text-center text-xs text-accent-red">{uploadError}</p>}

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>

      <form
        onSubmit={nameForm.handleSubmit((data) => updateNameMutation.mutate(data))}
        className="space-y-3 border-t border-border-default pt-4"
      >
        <label className="block">
          <span className="mb-1 block text-sm text-text-secondary">Nome de exibição</span>
          <input type="text" placeholder="Seu nome" autoComplete="name" className={inputClass} {...nameForm.register("name")} />
        </label>
        {nameForm.formState.errors.name && (
          <p className="text-xs text-accent-red">{nameForm.formState.errors.name.message}</p>
        )}
        {updateNameMutation.isError && (
          <p className="text-xs text-accent-red">
            {getApiErrorMessages(updateNameMutation.error, "Erro ao salvar nome.").join(" ")}
          </p>
        )}
        <button
          type="submit"
          disabled={updateNameMutation.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-gold px-4 py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-70"
        >
          {updateNameMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {nameSaved && <Check className="h-4 w-4" />}
          {nameSaved ? "Salvo!" : "Salvar nome"}
        </button>
      </form>
    </SettingsCard>
  );
}

// ─── Alterar senha ──────────────────────────────────────────────────────────

const passwordSchema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z
      .string()
      .min(8, "Mínimo de 8 caracteres.")
      .regex(/(?=.*[A-Z])/, "Deve conter ao menos uma letra maiúscula.")
      .regex(/(?=.*\d)/, "Deve conter ao menos um número."),
    confirmPassword: z.string().min(1, "Confirme a nova senha."),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });
type PasswordValues = z.infer<typeof passwordSchema>;

function PasswordSection() {
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [reauthedToken, setReauthedToken] = useState<string | null>(null);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);

  const credentialsQuery = useQuery<{ credentialId: string }[]>({
    queryKey: ["webauthn-credentials"],
    queryFn: () => api.get<{ credentialId: string }[]>("/api/auth/webauthn/credentials").then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });
  const webAuthnAvailable = (credentialsQuery.data?.length ?? 0) > 0 && browserSupportsWebAuthn();

  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: { currentPassword?: string; reauthedToken?: string; newPassword: string }) =>
      api.patch("/api/users/me/password", data),
    onSuccess: () => {
      form.reset();
      setReauthedToken(null);
      setBiometricError(null);
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2500);
    },
    onError: (error) => {
      const [msg] = getApiErrorMessages(error, "Erro ao alterar a senha.");
      form.setError("currentPassword", { message: msg });
    },
  });

  const handleBiometricConfirm = async () => {
    setBiometricError(null);
    setBiometricLoading(true);
    try {
      const { data: options } = await api.post<PublicKeyCredentialRequestOptionsJSON>("/api/auth/webauthn/reauth/options");
      const response = await startAuthentication({ optionsJSON: options });
      const { data } = await api.post<{ reauthedToken: string }>("/api/auth/webauthn/reauth/verify", response);
      setReauthedToken(data.reauthedToken);
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === "NotAllowedError") {
        setBiometricError("Operação cancelada pelo dispositivo.");
      } else {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setBiometricError(msg ?? "Não foi possível autenticar via biometria.");
      }
    } finally {
      setBiometricLoading(false);
    }
  };

  return (
    <SettingsCard title="Alterar senha" description="Atualize sua senha de acesso." icon={KeyRound}>
      <form
        onSubmit={form.handleSubmit((data) => {
          if (reauthedToken) {
            return mutation.mutate({ reauthedToken, newPassword: data.newPassword });
          }
          if (!data.currentPassword) {
            form.setError("currentPassword", { message: "Informe a senha atual." });
            return;
          }
          return mutation.mutate({ currentPassword: data.currentPassword, newPassword: data.newPassword });
        })}
        className="space-y-3"
      >
        {reauthedToken ? (
          <div className="flex items-center justify-between rounded-xl bg-accent-gold/10 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-accent-gold">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              Biometria confirmada
            </div>
            <button
              type="button"
              onClick={() => setReauthedToken(null)}
              className="text-xs text-text-secondary underline hover:text-text-primary"
            >
              Trocar
            </button>
          </div>
        ) : (
          <div>
            <input
              type="password"
              placeholder="Senha atual"
              autoComplete="current-password"
              className={inputClass}
              {...form.register("currentPassword")}
            />
            {form.formState.errors.currentPassword && (
              <p className="mt-1 text-xs text-accent-red">{form.formState.errors.currentPassword.message}</p>
            )}
            {webAuthnAvailable && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={handleBiometricConfirm}
                  disabled={biometricLoading}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary disabled:opacity-50"
                >
                  {biometricLoading ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Aguardando biometria...</>
                  ) : (
                    <><Fingerprint className="h-3.5 w-3.5 text-accent-gold" /> Confirmar com biometria</>
                  )}
                </button>
                {biometricError && <p className="mt-1 text-xs text-accent-red">{biometricError}</p>}
              </div>
            )}
          </div>
        )}

        <div>
          <input
            type="password"
            placeholder="Nova senha"
            autoComplete="new-password"
            className={inputClass}
            {...form.register("newPassword")}
          />
          {form.formState.errors.newPassword && (
            <p className="mt-1 text-xs text-accent-red">{form.formState.errors.newPassword.message}</p>
          )}
        </div>
        <div>
          <input
            type="password"
            placeholder="Confirmar nova senha"
            autoComplete="new-password"
            className={inputClass}
            {...form.register("confirmPassword")}
          />
          {form.formState.errors.confirmPassword && (
            <p className="mt-1 text-xs text-accent-red">{form.formState.errors.confirmPassword.message}</p>
          )}
        </div>

        {passwordSaved && (
          <p className="flex items-center gap-1 text-xs text-accent-gold">
            <Check className="h-3.5 w-3.5" /> Senha alterada com sucesso!
          </p>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-gold px-4 py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-70"
        >
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          <KeyRound className="h-4 w-4" />
          Alterar senha
        </button>
      </form>
    </SettingsCard>
  );
}

// ─── Ações da conta ─────────────────────────────────────────────────────────

function AccountActionsSection() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const resetDataMutation = useMutation({
    mutationFn: () => api.delete("/api/users/me/data"),
    onSuccess: () => {
      queryClient.clear();
      window.location.reload();
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: () => api.delete("/api/users/me"),
    onSuccess: async () => {
      try {
        await api.post("/api/auth/logout", { refreshToken: getRefreshToken() });
      } catch { /* ignored — account already deleted */ }
      clearTokens();
      navigate("/login", { replace: true });
    },
  });

  const handleLogout = async () => {
    try {
      await api.post("/api/auth/logout", { refreshToken: getRefreshToken() });
    } catch { /* ignored */ }
    clearTokens();
    queryClient.clear();
    navigate("/login", { replace: true });
  };

  const actionClass =
    "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary";
  const destructiveClass =
    "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-accent-red transition hover:bg-accent-red/10";

  return (
    <SettingsCard title="Conta" description="Tema, sessão e dados da sua conta." icon={SettingsIcon}>
      <div className="space-y-1">
        <button type="button" onClick={toggleTheme} className={actionClass}>
          {isDark ? <Sun className="h-5 w-5 shrink-0" /> : <Moon className="h-5 w-5 shrink-0" />}
          {isDark ? "Ativar tema claro" : "Ativar tema escuro"}
        </button>

        <button type="button" onClick={handleLogout} className={actionClass}>
          <LogOut className="h-5 w-5 shrink-0" />
          Trocar de conta
        </button>

        {!showResetConfirm ? (
          <button type="button" onClick={() => setShowResetConfirm(true)} className={destructiveClass}>
            <Trash2 className="h-5 w-5 shrink-0" />
            Limpar todos os dados
          </button>
        ) : (
          <div className="space-y-3 rounded-xl border border-accent-red/30 bg-accent-red/5 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-red" />
              <p className="text-xs text-text-secondary">
                Esta ação é <span className="font-semibold text-accent-red">irreversível</span>. Todas as suas
                transações e carteiras serão apagadas permanentemente.
              </p>
            </div>
            {resetDataMutation.isError && (
              <p className="text-xs text-accent-red">
                {getApiErrorMessages(resetDataMutation.error, "Erro ao limpar dados.").join(" ")}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 rounded-xl border border-bg-overlay px-3 py-2 text-xs font-semibold text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => resetDataMutation.mutate()}
                disabled={resetDataMutation.isPending}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent-red px-3 py-2 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-70"
              >
                {resetDataMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirmar reset
              </button>
            </div>
          </div>
        )}

        {!showDeleteConfirm ? (
          <button type="button" onClick={() => setShowDeleteConfirm(true)} className={destructiveClass}>
            <Trash2 className="h-5 w-5 shrink-0" />
            Excluir conta
          </button>
        ) : (
          <div className="space-y-3 rounded-xl border border-accent-red/30 bg-accent-red/5 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-red" />
              <p className="text-xs text-text-secondary">
                Esta ação é <span className="font-semibold text-accent-red">irreversível</span>. Todos os seus dados
                serão excluídos permanentemente.
              </p>
            </div>
            {deleteAccountMutation.isError && (
              <p className="text-xs text-accent-red">
                {getApiErrorMessages(deleteAccountMutation.error, "Erro ao excluir conta.").join(" ")}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 rounded-xl border border-bg-overlay px-3 py-2 text-xs font-semibold text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => deleteAccountMutation.mutate()}
                disabled={deleteAccountMutation.isPending}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent-red px-3 py-2 text-xs font-bold text-white transition hover:brightness-110 disabled:opacity-70"
              >
                {deleteAccountMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirmar exclusão
              </button>
            </div>
          </div>
        )}
      </div>
    </SettingsCard>
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

      {/* Seção perfil */}
      <ProfileSection />

      {/* Seção assinatura */}
      {subscription && (
        <div className="rounded-2xl bg-bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-accent-gold shrink-0" />
            <div>
              <h2 className="font-semibold text-text-primary">Assinatura</h2>
              <p className="text-xs text-text-secondary">
                {subscription.plan ?? "OSF Serviços"} · {SUBSCRIPTION_STATUS_LABEL[subscription.status ?? ""] ?? "Sem assinatura"}
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

      {/* Seção alterar senha */}
      <PasswordSection />

      {/* Seção ações da conta */}
      <AccountActionsSection />
    </section>
  );
}
