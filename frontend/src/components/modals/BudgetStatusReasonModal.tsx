import { useEffect, useState } from "react";
import { Loader2, XCircle } from "lucide-react";

import { ModalShell } from "./ModalShell";
import type { BudgetStatus } from "../../types/api";

const TITLE_BY_STATUS: Partial<Record<BudgetStatus, string>> = {
  CANCELADO: "Cancelar orçamento",
  REJEITADO: "Rejeitar orçamento",
};

const LABEL_BY_STATUS: Partial<Record<BudgetStatus, string>> = {
  CANCELADO: "Motivo do cancelamento (opcional)",
  REJEITADO: "Motivo da rejeição (opcional)",
};

export function BudgetStatusReasonModal({
  open,
  status,
  isPending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  status: BudgetStatus | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  if (!open || !status) {
    return null;
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={TITLE_BY_STATUS[status] ?? "Atualizar status"}
      icon={<XCircle className="h-6 w-6 text-accent-red" />}
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex-1 rounded-xl border border-bg-muted bg-transparent px-5 py-3 text-sm font-bold text-white transition hover:bg-bg-overlay disabled:cursor-not-allowed disabled:opacity-70"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason.trim() || undefined)}
            disabled={isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-red px-5 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar
          </button>
        </div>
      }
    >
      <label className="block">
        <span className="mb-1 block text-sm text-text-secondary">
          {LABEL_BY_STATUS[status] ?? "Motivo (opcional)"}
        </span>
        <textarea
          maxLength={500}
          rows={4}
          autoFocus
          placeholder="Descreva o motivo, se desejar"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full resize-none rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold"
        />
      </label>
    </ModalShell>
  );
}
