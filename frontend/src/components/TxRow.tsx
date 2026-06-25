import { ArrowLeftRight, Calendar, Edit2, Trash2 } from "lucide-react";

import { cn } from "../lib/utils";
import type { Transaction } from "../types/finance";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
function fmtDate(iso: string) {
  const d = new Date(iso);
  return !iso || isNaN(d.getTime())
    ? "--/--/--"
    : new Intl.DateTimeFormat("pt-BR").format(d);
}

export function TxRow({
  tx,
  onEdit,
  onDelete,
}: {
  tx: Transaction;
  onEdit?: (tx: Transaction) => void;
  onDelete?: (tx: Transaction) => void;
}) {
  const isTransfer = tx.type === "TRANSFER" || Boolean(tx.carteiraDestinoId);
  const isIncome = tx.type === "INCOME";
  const label =
    tx.description ||
    (isIncome ? "Entrada" : isTransfer ? "Transferência" : "Saída");
  const amountCls = tx.agendado
    ? "text-text-muted"
    : isIncome
      ? "text-accent-lime"
      : isTransfer
        ? "text-blue-400"
        : "text-accent-red";
  const sign = isIncome || isTransfer ? "+" : "–";

  return (
    <div className="group flex items-center gap-3 border-b border-bg-muted py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {isTransfer && (
            <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-blue-400" />
          )}
          <p className="truncate text-sm font-semibold">{label}</p>
          {tx.agendado && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-semibold text-blue-400">
              <Calendar className="h-3 w-3" />
              Agendado
            </span>
          )}
        </div>
        <p className="text-xs text-text-secondary">{fmtDate(tx.date)}</p>
      </div>

      <span className={cn("ml-4 shrink-0 font-bold tabular-nums", amountCls)}>
        {sign}
        {brl.format(tx.amount)}
      </span>

      {(onEdit || onDelete) && (
        <div className="flex shrink-0 items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(tx)}
              className="grid h-8 w-8 place-items-center rounded-lg text-text-secondary hover:bg-bg-overlay hover:text-white"
              aria-label="Editar transação"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(tx)}
              className="grid h-8 w-8 place-items-center rounded-lg text-text-secondary hover:bg-bg-overlay hover:text-accent-red"
              aria-label="Excluir transação"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
