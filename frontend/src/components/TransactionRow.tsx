import { Edit2, Trash2 } from "lucide-react";

import { formatCurrency } from "../lib/finance";
import { cn } from "../lib/utils";
import type { Transaction, Category } from "../types/finance";
import { DynamicIcon } from "./DynamicIcon";

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--/--/----";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function TransactionRow({
  transaction,
  onEdit,
  onDelete,
  categories,
}: {
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  categories?: Category[];
}) {
  const categoriesMap = new Map<string, Category>();
  (categories ?? []).forEach((c) => categoriesMap.set(c.id, c));

  const resolvedCategory =
    transaction.category ?? (transaction.categoryId ? categoriesMap.get(transaction.categoryId) : undefined);

  const category = resolvedCategory ?? {
    id: "uncategorized",
    name: transaction.type === "INCOME" ? "Ganho" : "Despesa",
    color: transaction.type === "INCOME" ? "#A3E635" : "#6B7280",
    icon: transaction.type === "INCOME" ? "TrendingUp" : "Receipt",
  };
  const isIncome = transaction.type === "INCOME";

  return (
    <div className="group flex items-center gap-3 border-b border-bg-muted py-3">
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
        style={{ backgroundColor: `${category.color}22` }}
      >
        <DynamicIcon
          name={category.icon}
          className="h-5 w-5"
          style={{ color: category.color }}
        />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{category.name}</p>
        {transaction.description && (
          <p className="truncate text-xs text-text-secondary">{transaction.description}</p>
        )}
        <p className="text-xs text-text-muted">{formatDate(transaction.date)}</p>
      </div>

      <strong
        className={cn(
          "shrink-0 text-sm font-semibold",
          isIncome ? "text-accent-lime" : "text-accent-red",
        )}
      >
        {isIncome ? "+" : "-"}
        {formatCurrency(transaction.amount)}
      </strong>

      <div className="flex shrink-0 items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <button
          type="button"
          onClick={() => onEdit(transaction)}
          className="grid h-8 w-8 place-items-center rounded-lg text-text-secondary hover:bg-bg-overlay hover:text-white"
          aria-label="Editar transação"
        >
          <Edit2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(transaction)}
          className="grid h-8 w-8 place-items-center rounded-lg text-text-secondary hover:bg-bg-overlay hover:text-accent-red"
          aria-label="Excluir transação"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

