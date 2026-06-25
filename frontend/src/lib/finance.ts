import type {
  Category,
  CategoryExpense,
  Transaction,
  TransactionType,
} from "../types/finance";

export const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatCurrency(value: number) {
  return brlFormatter.format(value);
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

export function readNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value.replace(",", "."));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return 0;
}

export function readString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "";
}

export function normalizeCategory(value: unknown, fallbackIndex = 0): Category {
  const item = asRecord(value);

  return {
    id:
      readString(item.id, item._id, item.categoryId) ||
      `category-${fallbackIndex}`,
    name: readString(item.name, item.categoryName, item.label) || "Categoria",
    color: readString(item.color, item.categoryColor) || "#6B7280",
    icon: readString(item.icon, item.iconName, item.categoryIcon) || "Receipt",
    isDefault: item.isDefault === true,
  };
}

export function normalizeTransaction(
  value: unknown,
  fallbackIndex = 0,
): Transaction {
  const item = asRecord(value);
  const nestedCategory = asRecord(item.category);
  const type = readString(item.type, item.transactionType).toUpperCase();
  const category =
    Object.keys(nestedCategory).length > 0
      ? normalizeCategory(nestedCategory, fallbackIndex)
      : undefined;

  return {
    id: readString(item.id, item._id) || `transaction-${fallbackIndex}`,
    type: type === "INCOME" ? "INCOME" : "EXPENSE",
    amount: readNumber(item.amount, item.value, item.total),
    date:
      readString(item.date, item.createdAt, item.paidAt, item.dueDate) ||
      new Date().toISOString(),
    description: readString(item.description, item.notes),
    categoryId: readString(
      item.categoryId,
      nestedCategory.id,
      nestedCategory._id,
    ),
    category:
      category ??
      (type === "INCOME"
        ? {
            id: "income",
            name: "Ganho",
            color: "#A3E635",
            icon: "TrendingUp",
          }
        : undefined),
  };
}

export function normalizeTransactionsResponse(data: unknown) {
  const record = asRecord(data);
  const source =
    record.items ??
    record.data ??
    record.transactions ??
    record.results ??
    data;

  const total = readNumber(record.total);
  const page = readNumber(record.page);
  const limit = readNumber(record.limit);

  return {
    transactions: asArray(source).map(normalizeTransaction),
    hasMore:
      Boolean(record.hasMore ?? record.nextPage ?? record.nextCursor) ||
      (total > 0 && page > 0 && limit > 0 && page * limit < total),
  };
}

export function normalizeExpenseCategory(
  value: unknown,
  fallbackIndex = 0,
): CategoryExpense {
  const item = asRecord(value);
  const nestedCategory = asRecord(item.category);
  const category = normalizeCategory(
    Object.keys(nestedCategory).length > 0 ? nestedCategory : item,
    fallbackIndex,
  );
  const amount = readNumber(
    item.amount,
    item.total,
    item.value,
    item.currentAmount,
  );
  const previousAmount = readNumber(
    item.previousAmount,
    item.previousTotal,
    item.previousValue,
  );
  const variation =
    "variation" in item || "changePercent" in item
      ? readNumber(item.variation, item.changePercent)
      : previousAmount > 0
        ? ((amount - previousAmount) / previousAmount) * 100
        : 0;

  return {
    ...category,
    amount,
    previousAmount,
    variation,
  };
}

export function dateInputValue(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

export function buildTransactionPayload(values: {
  amount: number;
  date: string;
  description?: string;
  categoryId?: string;
  type: TransactionType;
}) {
  return {
    type: values.type,
    value: values.amount, // ✅ corrigido: era "amount", backend espera "value"
    date: values.date,
    description: values.description?.trim() || undefined,
    categoryId: values.categoryId || undefined,
  };
}
