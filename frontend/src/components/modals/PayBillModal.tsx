import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "../../lib/finance";
import { useWallets } from "./TransactionFormFields";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  value: number;
  defaultCarteiraId?: string;
  isPending: boolean;
  onConfirm: (carteiraId: string | undefined) => void;
};

export function PayBillModal({ open, onClose, title, value, defaultCarteiraId, isPending, onConfirm }: Props) {
  const walletsQuery = useWallets();
  const [selectedId, setSelectedId] = useState(defaultCarteiraId ?? "");

  useEffect(() => {
    if (open) setSelectedId(defaultCarteiraId ?? "");
  }, [open, defaultCarteiraId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-bg-muted bg-bg-card p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-white">Confirmar Pagamento</h2>
          <p className="mt-1 text-sm text-text-secondary truncate">{title}</p>
        </div>

        <p className="text-3xl font-bold text-accent-lime">{formatCurrency(value)}</p>

        <div>
          <p className="text-sm text-text-secondary mb-3">Debitar da carteira <span className="text-accent-red">*</span></p>
          {walletsQuery.data?.length === 0 ? (
            <p className="text-sm text-text-muted">Nenhuma carteira cadastrada.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(walletsQuery.data ?? []).map((w) => (
                <button
                  key={w._id}
                  type="button"
                  onClick={() => setSelectedId(w._id)}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition border ${
                    selectedId === w._id
                      ? "border-accent-lime bg-accent-lime/10 text-white"
                      : "border-bg-muted text-text-secondary hover:text-white"
                  }`}
                >
                  {w.nome}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-xl border border-bg-muted px-4 py-2 text-sm text-white hover:bg-bg-muted transition disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selectedId || undefined)}
            disabled={isPending || !selectedId}
            className="flex items-center gap-2 rounded-xl bg-accent-lime px-4 py-2 text-sm font-bold text-black disabled:opacity-70"
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar Pagamento
          </button>
        </div>
      </div>
    </div>
  );
}
