import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { DynamicIcon } from "../components/DynamicIcon";
import { api } from "../lib/api";
import { formatCurrency, normalizeExpenseCategory } from "../lib/finance";
import { cn } from "../lib/utils";
import type { CategoryExpense } from "../types/finance";

const periodTabs = [
  { label: "Semanal", value: "weekly" },
  { label: "Mensal", value: "monthly" },
  { label: "Anual", value: "yearly" },
] as const;

type ExpensePeriod = (typeof periodTabs)[number]["value"];

function CategoryRow({ category, onClick }: { category: CategoryExpense; onClick: () => void }) {
  const variation = Number.isFinite(category.variation) ? category.variation : 0;
  const isIncrease = variation > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-bg-muted bg-bg-card p-4 text-left transition hover:border-bg-overlay hover:bg-bg-overlay"
    >
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
        style={{ backgroundColor: `${category.color}22` }}
      >
        <DynamicIcon name={category.icon} className="h-5 w-5" style={{ color: category.color }} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">{category.name}</p>
        <p className="text-xs text-text-secondary">Total no período</p>
      </div>

      <div className="text-right">
        <p className="text-sm font-semibold text-white">{formatCurrency(category.amount)}</p>
        <p
          className={cn(
            "text-xs font-semibold",
            isIncrease ? "text-accent-red" : "text-accent-lime",
          )}
        >
          {isIncrease ? "↑" : "↓"} {Math.abs(variation).toFixed(1)}%
        </p>
      </div>
    </button>
  );
}

export function ExpensesPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<ExpensePeriod>("monthly");

  const expensesQuery = useQuery({
    queryKey: ["expenses", period],
    queryFn: async () => {
      const { data } = await api.get("/api/expenses", { params: { period } });
      const source =
        (data && typeof data === "object" && "categories" in data
          ? (data as { categories?: unknown }).categories
          : Array.isArray(data)
            ? data
            : (data as { data?: unknown })?.data) ?? [];

      return (Array.isArray(source) ? source : []).map((item, index) =>
        normalizeExpenseCategory(item, index),
      );
    },
  });

  const categories = expensesQuery.data ?? [];

  const topCategory = useMemo(
    () => categories.reduce<CategoryExpense | null>((best, current) => {
      if (!best || current.amount > best.amount) {
        return current;
      }

      return best;
    }, null),
    [categories],
  );

  return (
    <section className="space-y-5">
      <header>
        <p className="text-sm text-text-secondary">Controle de gastos</p>
        <h1 className="text-3xl font-bold">Gastos por categoria</h1>
      </header>

      <div className="flex gap-2 overflow-x-auto rounded-2xl bg-bg-card p-2">
        {periodTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setPeriod(tab.value)}
            className={cn(
              "rounded-xl px-4 py-2.5 text-sm font-semibold transition",
              period === tab.value
                ? "bg-bg-muted text-white"
                : "text-text-secondary hover:bg-bg-overlay hover:text-white",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {expensesQuery.isLoading ? (
        <div className="rounded-2xl bg-bg-card p-6">
          <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin text-accent-lime" />
            Carregando categorias...
          </div>
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-2xl bg-bg-card p-8 text-center text-sm text-text-secondary">
          Nenhuma categoria de gasto encontrada para o período selecionado.
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
          <div className="rounded-2xl bg-bg-card p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <TrendingDown className="h-4 w-4 text-accent-red" />
              Gastos por categoria
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_240px]">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categories}
                      dataKey="amount"
                      innerRadius={68}
                      outerRadius={96}
                      paddingAngle={2}
                    >
                      {categories.map((category) => (
                        <Cell key={category.id} fill={category.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(Number(value))}
                      contentStyle={{
                        backgroundColor: "#111827",
                        border: "1px solid rgba(148,163,184,0.2)",
                        borderRadius: 14,
                        color: "#fff",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="relative -mt-44 flex h-24 items-center justify-center text-center">
                  <div className="max-w-[160px]">
                    <p className="text-[11px] uppercase tracking-[0.25em] text-text-muted">Mais gasto</p>
                    <p className="text-sm font-semibold text-white">{topCategory?.name ?? "—"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-center gap-3 rounded-2xl bg-bg-muted p-3">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">{category.name}</p>
                      <p className="text-xs text-text-secondary">{formatCurrency(category.amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="rounded-2xl bg-bg-card p-5">
            <div className="mb-4 flex items-center justify-between gap-2 text-sm font-semibold text-white">
              <span>Resumo</span>
              <TrendingUp className="h-4 w-4 text-accent-lime" />
            </div>
            <p className="text-xs text-text-secondary">
              Clique em uma categoria para filtrar as transações do período atual.
            </p>
            <div className="mt-4 space-y-3">
              {categories.map((category) => (
                <CategoryRow
                  key={category.id}
                  category={category}
                  onClick={() => navigate(`/transactions?type=EXPENSE&categoryId=${category.id}`)}
                />
              ))}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
