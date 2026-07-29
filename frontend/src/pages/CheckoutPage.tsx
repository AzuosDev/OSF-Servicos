import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Copy, CreditCard, Loader2, QrCode } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Field } from "../components/Field";
import { SubmitButton } from "../components/SubmitButton";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { formatCents } from "../lib/currency";
import { getApiErrorText } from "../lib/errors";
import { cn } from "../lib/utils";
import type { BillingMethod, CreateCheckoutResponse, PixCheckoutData, PixStatusResponse } from "../types/api";

const MONTHLY_PRICE_CENTS = 4990;

function isPixResponse(data: CreateCheckoutResponse): data is { pixData: PixCheckoutData } {
  return "pixData" in data;
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const { refreshMe } = useAuth();
  const [method, setMethod] = useState<BillingMethod>("stripe");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [pixData, setPixData] = useState<PixCheckoutData | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<CreateCheckoutResponse>("/api/billing/checkout", {
        plan: "aklavajato",
        method,
        ...(method === "pix" ? { cpfCnpj } : {}),
      });
      return data;
    },
    onSuccess: (data) => {
      setErrorMessage(null);
      if (isPixResponse(data)) {
        setPixData(data.pixData);
      } else {
        window.location.href = data.url;
      }
    },
    onError: (error) => {
      setErrorMessage(getApiErrorText(error, "Não foi possível iniciar o pagamento."));
    },
  });

  const pixStatusQuery = useQuery({
    queryKey: ["pix-status", pixData?.paymentId],
    queryFn: async () => {
      const { data } = await api.get<PixStatusResponse>(`/api/billing/pix/${pixData?.paymentId}/status`);
      return data;
    },
    enabled: Boolean(pixData?.paymentId),
    refetchInterval: (query) => (query.state.data?.active ? false : 5000),
  });

  const pixConfirmed = pixStatusQuery.data?.active ?? false;

  useEffect(() => {
    if (!pixConfirmed) return;
    void refreshMe().then(() => navigate("/dashboard", { replace: true }));
  }, [pixConfirmed, refreshMe, navigate]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (method === "pix" && cpfCnpj.trim().length < 11) {
      setErrorMessage("Informe um CPF ou CNPJ válido.");
      return;
    }
    checkoutMutation.mutate();
  }

  async function handleCopy() {
    if (!pixData) return;
    await navigator.clipboard.writeText(pixData.copyPaste);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-card bg-bg-card p-8 shadow-xl ring-1 ring-bg-overlay">
        <div className="mb-6 text-center">
          <h1 className="font-sans text-2xl font-bold text-text-primary">AkLavajato App</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Assine para continuar usando a gestão completa do seu lava-jato.
          </p>
          <p className="mt-3 text-3xl font-bold text-text-primary">
            {formatCents(MONTHLY_PRICE_CENTS)}
            <span className="text-sm font-normal text-text-secondary">/mês</span>
          </p>
        </div>

        {pixData ? (
          <div className="space-y-4 text-center">
            <img
              src={`data:image/png;base64,${pixData.qrCodeImage}`}
              alt="QR Code PIX"
              className="mx-auto h-52 w-52 rounded-icon bg-white p-2"
            />
            <p className="text-xs text-text-secondary">
              Escaneie o QR Code ou copie o código abaixo no app do seu banco.
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-default bg-bg-muted px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-bg-overlay"
            >
              {copied ? <Check className="h-4 w-4 text-accent-lime" /> : <Copy className="h-4 w-4" />}
              {copied ? "Código copiado!" : "Copiar código PIX"}
            </button>
            <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Aguardando confirmação do pagamento...
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMethod("stripe")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition",
                  method === "stripe"
                    ? "border-accent-lime bg-accent-lime/10 text-text-primary"
                    : "border-border-default bg-bg-muted text-text-secondary hover:bg-bg-overlay",
                )}
              >
                <CreditCard className="h-4 w-4" /> Cartão
              </button>
              <button
                type="button"
                onClick={() => setMethod("pix")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition",
                  method === "pix"
                    ? "border-accent-lime bg-accent-lime/10 text-text-primary"
                    : "border-border-default bg-bg-muted text-text-secondary hover:bg-bg-overlay",
                )}
              >
                <QrCode className="h-4 w-4" /> PIX
              </button>
            </div>

            {method === "pix" && (
              <Field
                label="CPF ou CNPJ"
                value={cpfCnpj}
                onChange={(event) => setCpfCnpj(event.target.value)}
                placeholder="Somente números"
                inputMode="numeric"
              />
            )}

            {errorMessage && (
              <div className="rounded-icon border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-sm text-accent-red">
                {errorMessage}
              </div>
            )}

            <SubmitButton loading={checkoutMutation.isPending}>
              {method === "stripe" ? "Ir para o pagamento" : "Gerar QR Code PIX"}
            </SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
