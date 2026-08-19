import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, PartyPopper, QrCode } from "lucide-react";

import { ModalShell } from "./ModalShell";
import { Field } from "../Field";
import { SubmitButton } from "../SubmitButton";
import { api } from "../../lib/api";
import { formatCurrency, formatDisplayDate } from "../../lib/finance";
import { getApiErrorText } from "../../lib/errors";
import type { PendingBillingSummary, PixCheckoutData, PixStatusResponse } from "../../types/api";

export function PixBillingReminderModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [pixData, setPixData] = useState<PixCheckoutData | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const summaryQuery = useQuery<PendingBillingSummary>({
    queryKey: ["billing-pending"],
    queryFn: async () => (await api.get<PendingBillingSummary>("/api/billing/pending")).data,
    enabled: open,
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => (await api.post<PixCheckoutData>("/api/billing/pending/checkout", { cpfCnpj })).data,
    onSuccess: (data) => {
      setErrorMessage(null);
      setPixData(data);
    },
    onError: (error) => {
      setErrorMessage(getApiErrorText(error, "Não foi possível gerar o PIX."));
    },
  });

  const pixStatusQuery = useQuery({
    queryKey: ["billing-pix-status", pixData?.paymentId],
    queryFn: async () => (await api.get<PixStatusResponse>(`/api/billing/pix/${pixData?.paymentId}/status`)).data,
    enabled: open && Boolean(pixData?.paymentId),
    refetchInterval: (query) => (query.state.data?.active ? false : 5000),
  });

  const pixConfirmed = pixStatusQuery.data?.active ?? false;

  useEffect(() => {
    if (!pixConfirmed) return;
    queryClient.invalidateQueries({ queryKey: ["billing-pending"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }, [pixConfirmed, queryClient]);

  function handleClose() {
    setPixData(null);
    setCpfCnpj("");
    setErrorMessage(null);
    onClose();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (cpfCnpj.trim().length < 11) {
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

  if (!open) {
    return null;
  }

  const summary = summaryQuery.data;

  return (
    <ModalShell open={open} onClose={handleClose} title="Mensalidade pendente" icon={<QrCode className="h-6 w-6 text-accent-gold" />}>
      {summaryQuery.isLoading && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando...
        </div>
      )}

      {pixConfirmed && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <PartyPopper className="h-10 w-10 text-accent-gold" />
          <p className="text-sm font-semibold text-text-primary">Pagamento confirmado!</p>
          <p className="text-xs text-text-secondary">Obrigado por manter sua assinatura em dia.</p>
        </div>
      )}

      {!pixConfirmed && summary && !summary.hasPending && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <PartyPopper className="h-10 w-10 text-accent-gold" />
          <p className="text-sm text-text-secondary">Nenhuma mensalidade pendente no momento.</p>
        </div>
      )}

      {!pixConfirmed && summary?.hasPending && (
        pixData ? (
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
              {copied ? <Check className="h-4 w-4 text-accent-gold" /> : <Copy className="h-4 w-4" />}
              {copied ? "Código copiado!" : "Copiar código PIX"}
            </button>
            <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Aguardando confirmação do pagamento...
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-2xl border border-bg-muted bg-bg-muted/70 p-4">
              <p className="text-sm text-text-secondary">
                {summary.installments > 1
                  ? `${summary.installments} mensalidades em aberto`
                  : "Mensalidade em aberto"}
              </p>
              <p className="mt-1 text-2xl font-bold text-text-primary">{formatCurrency(summary.totalAmount)}</p>
              <ul className="mt-3 space-y-1 text-xs text-text-secondary">
                {summary.invoices.map((invoice) => (
                  <li key={invoice.referenceMonth} className="flex items-center justify-between">
                    <span>Ref. {invoice.referenceMonth}</span>
                    <span>{formatCurrency(invoice.amount)} · vence {formatDisplayDate(invoice.dueDate)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Field
              label="CPF ou CNPJ"
              value={cpfCnpj}
              onChange={(event) => setCpfCnpj(event.target.value)}
              placeholder="Somente números"
              inputMode="numeric"
            />

            {errorMessage && (
              <div className="rounded-icon border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-sm text-accent-red">
                {errorMessage}
              </div>
            )}

            <SubmitButton loading={checkoutMutation.isPending}>Gerar QR Code PIX</SubmitButton>
          </form>
        )
      )}
    </ModalShell>
  );
}
