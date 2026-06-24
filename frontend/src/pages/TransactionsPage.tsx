import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Filter, Loader2, Plus, TrendingDown, TrendingUp, Wallet } from "lucide-react";

import { TransactionRow } from "../components/TransactionRow";
import { AddExpenseModal } from "../components/modals/AddExpenseModal";
import { AddIncomeModal } from "../components/modals/AddIncomeModal";
import { EditTransactionModal } from "../components/modals/EditTransactionModal";
import { useCategories } from "../components/modals/TransactionFormFields";
import { api } from "../lib/api";
import { normalizeTransactionsResponse, readString } from "../lib/finance";
import { cn } from "../lib/utils";
import type { TransactionsResponse } from "../types/api";
import type { Transaction, TransactionType } from "../types/finance";

const tabs: Array<{ label: string; value: "ALL" | TransactionType }> = [
  { label: "Todos", value: "ALL" },
  { label: "Gastos", value: "EXPENSE" },
  { label: "Ganhos", value: "INCOME" },
];

const months = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function groupDateLabel(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sem data";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
  }).format(date);
}

function dateKey(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  return date.toISOString().slice(0, 10);
}

export function TransactionsPage() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [choiceOpen, setChoiceOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const queryClient = useQueryClient();

  const type = readString(searchParams.get("type")).toUpperCase();
  const selectedType: "ALL" | TransactionType =
    type === "EXPENSE" || type === "INCOME" ? type : "ALL";
  const categoryId = searchParams.get("categoryId") ?? "";
  const month = Number(searchParams.get("month") ?? today.getMonth() + 1);
  const year = Number(searchParams.get("year") ?? currentYear);
  const action = searchParams.get("action");
  const addExpenseOpen = action === "create" && selectedType !== "INCOME";
  const addIncomeOpen = action === "create" && selectedType === "INCOME";
  const years = useMemo(
    () => Array.from({ length: 4 }, (_, index) => currentYear - index),
    [currentYear],
  );

  const categoriesQuery = useCategories();

  const transactionsQuery = useInfiniteQuery({
    queryKey: ["transactions", selectedType, categoryId, month, year],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const { data } = await api.get<TransactionsResponse>("/api/transactions", {
        params: {
          page: pageParam,
          limit: 20,
          type: selectedType === "ALL" ? undefined : selectedType,
          categoryId: categoryId || undefined,
          month,
          year,
        },
      });

      return normalizeTransactionsResponse(data);
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.hasMore ? allPages.length + 1 : undefined,
  });

  const transactions =
    transactionsQuery.data?.pages
      .flatMap((page) => page.transactions)
      .filter((transaction) => {
        const date = new Date(transaction.date);
        const matchesCategory = !categoryId || transaction.categoryId === categoryId;
        const matchesPeriod =
          !Number.isNaN(date.getTime()) &&
          date.getMonth() + 1 === month &&
          date.getFullYear() === year;

        return matchesCategory && matchesPeriod;
      }) ?? [];

  const groupedTransactions = useMemo(() => {
    const groups = new Map<string, Transaction[]>();

    transactions.forEach((transaction) => {
      const key = dateKey(transaction.date);
      groups.set(key, [...(groups.get(key) ?? []), transaction]);
    });

    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      label: groupDateLabel(items[0]?.date ?? key),
      items,
    }));
  }, [transactions]);

  const deleteMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      await api.delete(`/api/transactions/${transactionId}`);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-expenses"] }),
      ]);
      setDeleting(null);
    },
  });

  const patchParams = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);

    Object.entries(patch).forEach(([key, value]) => {
      if (!value) {
        next.delete(key);
        return;
      }

      next.set(key, value);
    });

    setSearchParams(next);
  };

  const closeCreateModal = () => {
    patchParams({ action: undefined });
  };

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-text-secondary">Histórico financeiro</p>
          <h1 className="font-sans text-3xl font-bold">Transações</h1>
        </div>
        <button
          type="button"
          onClick={() => setChoiceOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-accent-lime px-4 py-3 text-sm font-bold text-black transition hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          Nova
        </button>
      </header>

      <div className="flex gap-2 overflow-x-auto rounded-2xl bg-bg-card p-2">
        {tabs.map((tab) => {
          const active = selectedType === tab.value;

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() =>
                patchParams({
                  type: tab.value === "ALL" ? undefined : tab.value,
                  categoryId: tab.value === "INCOME" ? undefined : categoryId,
                  action: undefined,
                })
              }
              className={cn(
                "rounded-xl px-4 py-2.5 text-sm font-semibold transition",
                active
                  ? "bg-bg-muted text-white"
                  : "text-text-secondary hover:bg-bg-overlay hover:text-white",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl bg-bg-card p-4">
        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 text-sm font-semibold text-white"
        >
          <span className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-accent-lime" />
            Filtros
          </span>
          <ChevronDown className={cn("h-4 w-4 transition", filtersOpen && "rotate-180")} />
        </button>

        {filtersOpen && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <select
              value={categoryId}
              disabled={selectedType === "INCOME"}
              onChange={(event) => patchParams({ categoryId: event.target.value || undefined })}
              className="rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-sm text-white outline-none focus:border-accent-lime disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Todas as categorias</option>
              {(categoriesQuery.data ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <select
              value={month}
              onChange={(event) => patchParams({ month: event.target.value })}
              className="rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-sm text-white outline-none focus:border-accent-lime"
            >
              {months.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </select>

            <select
              value={year}
              onChange={(event) => patchParams({ year: event.target.value })}
              className="rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-sm text-white outline-none focus:border-accent-lime"
            >
              {years.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-bg-card p-5">
        {transactionsQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-xl bg-bg-muted" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-16 text-center">
            <Wallet className="mx-auto mb-3 h-10 w-10 text-text-muted" />
            <p className="text-sm text-text-secondary">Nenhuma transação encontrada</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedTransactions.map((group) => (
              <div key={group.key}>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-text-muted">
                  {group.label}
                </p>
                {group.items.map((transaction) => (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    onEdit={setEditing}
                    onDelete={setDeleting}
                    categories={categoriesQuery.data ?? []}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {transactionsQuery.hasNextPage && (
          <button
            type="button"
            onClick={() => transactionsQuery.fetchNextPage()}
            disabled={transactionsQuery.isFetchingNextPage}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-bg-muted px-4 py-3 text-sm font-semibold text-white hover:bg-bg-muted disabled:opacity-60"
          >
            {transactionsQuery.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
            Carregar mais
          </button>
        )}
      </div>

      {choiceOpen && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 p-4 backdrop-blur-sm sm:place-items-center">
          <div className="w-full max-w-sm rounded-2xl border border-bg-muted bg-bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-sans text-lg font-bold">Nova movimentação</h2>
              <button
                type="button"
                onClick={() => setChoiceOpen(false)}
                className="rounded-lg px-2 py-1 text-text-secondary hover:bg-bg-overlay hover:text-white"
              >
                Fechar
              </button>
            </div>
            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => {
                  setChoiceOpen(false);
                  patchParams({ type: "EXPENSE", action: "create" });
                }}
                className="flex items-center gap-3 rounded-xl bg-bg-muted p-4 text-left hover:bg-bg-overlay"
              >
                <TrendingDown className="h-5 w-5 text-accent-red" />
                <span className="font-semibold">Adicionar Gasto</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setChoiceOpen(false);
                  patchParams({ type: "INCOME", action: "create", categoryId: undefined });
                }}
                className="flex items-center gap-3 rounded-xl bg-bg-muted p-4 text-left hover:bg-bg-overlay"
              >
                <TrendingUp className="h-5 w-5 text-accent-lime" />
                <span className="font-semibold">Adicionar Ganho</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <AddExpenseModal open={addExpenseOpen} onClose={closeCreateModal} />
      <AddIncomeModal open={addIncomeOpen} onClose={closeCreateModal} />
      <EditTransactionModal transaction={editing} onClose={() => setEditing(null)} />

      {deleting && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-bg-muted bg-bg-card p-5">
            <h2 className="font-sans text-lg font-bold">Tem certeza?</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Esta ação não pode ser desfeita.
            </p>
            {deleteMutation.isError && (
              <p className="mt-3 rounded-xl bg-accent-red/10 p-3 text-sm text-accent-red">
                Não foi possível excluir a transação.
              </p>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="rounded-xl border border-bg-muted px-4 py-3 text-sm font-semibold text-white hover:bg-bg-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deleting.id)}
                disabled={deleteMutation.isPending}
                className="flex items-center justify-center gap-2 rounded-xl bg-accent-red px-4 py-3 text-sm font-bold text-white hover:brightness-110 disabled:opacity-60"
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

