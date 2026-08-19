import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { TransactionModal } from "../components/modals/TransactionModal";
import { DynamicIcon } from "../components/DynamicIcon";
import { api } from "../lib/api";
import { formatCurrency, localDateString, normalizeExpenseCategory } from "../lib/finance";
import { cn } from "../lib/utils";
import type { CategoryExpense } from "../types/finance";

type Period = "daily" | "weekly" | "monthly" | "yearly";
type FundsType = "EXPENSE" | "INCOME";

const periodTabs: { label: string; value: Period }[] = [
  { label: "Diário", value: "daily" },
  { label: "Semanal", value: "weekly" },
  { label: "Mensal", value: "monthly" },
  { label: "Anual", value: "yearly" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, index) => CURRENT_YEAR - index);

const typeCopy: Record<FundsType, {
  label: string;
  title: string;
  topLabel: string;
  emptyMessage: string;
  icon: typeof TrendingDown;
  accentClass: string;
}> = {
  EXPENSE: {
    label: "Gastos",
    title: "Gastos por categoria",
    topLabel: "Mais gasto",
    emptyMessage: "Nenhuma categoria de gasto encontrada para o período selecionado.",
    icon: TrendingDown,
    accentClass: "text-accent-red",
  },
  INCOME: {
    label: "Ganhos",
    title: "Ganhos por categoria",
    topLabel: "Mais recebido",
    emptyMessage: "Nenhuma categoria de ganho encontrada para o período selecionado.",
    icon: TrendingUp,
    accentClass: "text-accent-gold",
  },
};

function currentYYYYMM() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Espelha o cálculo de semana (domingo–sábado) feito no backend, só para exibir o intervalo ao usuário.
function weekRangeLabel(dateKey: string) {
  const anchor = new Date(`${dateKey}T00:00:00.000Z`);
  const dow = anchor.getUTCDay();
  const sunday = new Date(anchor);
  sunday.setUTCDate(anchor.getUTCDate() - dow);
  const saturday = new Date(sunday);
  saturday.setUTCDate(sunday.getUTCDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
  return `${fmt(sunday)} a ${fmt(saturday)}`;
}

function CategoryRow({ category, onClick }: { category: CategoryExpense; onClick: () => void }) {
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
      </div>
    </button>
  );
}

export function ResumoPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [txType, setTxType] = useState<FundsType>(
    searchParams.get("type") === "INCOME" ? "INCOME" : "EXPENSE",
  );
  const [period, setPeriod] = useState<Period>("monthly");
  const [dailyDate, setDailyDate] = useState(localDateString());
  const [weeklyDate, setWeeklyDate] = useState(localDateString());
  const [monthValue, setMonthValue] = useState(currentYYYYMM());
  const [year, setYear] = useState(CURRENT_YEAR);
  const [addOpen, setAddOpen] = useState(false);

  const copy = typeCopy[txType];

  const params = useMemo(() => {
    if (period === "daily") return { type: txType, period, date: dailyDate };
    if (period === "weekly") return { type: txType, period, date: weeklyDate };
    if (period === "monthly") {
      const [y, m] = monthValue.split("-").map(Number);
      return { type: txType, period, year: y, month: m };
    }
    return { type: txType, period, year };
  }, [txType, period, dailyDate, weeklyDate, monthValue, year]);

  const breakdownQuery = useQuery({
    queryKey: ["category-breakdown", params],
    queryFn: async () => {
      const { data } = await api.get<{ items: unknown[] }>("/api/dashboard/category-breakdown", { params });
      return (data.items ?? []).map((item, index) => normalizeExpenseCategory(item, index));
    },
  });

  const categories = breakdownQuery.data ?? [];

  const topCategory = useMemo(
    () =>
      categories.reduce<CategoryExpense | null>((best, current) => {
        if (!best || current.amount > best.amount) return current;
        return best;
      }, null),
    [categories],
  );

  const goToTransactions = (categoryId: string) => {
    const base = `/transactions?type=${txType}`;
    const categoryParam =
      !categoryId || categoryId.startsWith("category-") ? "&semCategoria=true" : `&categoryId=${categoryId}`;
    if (period === "monthly") {
      const [y, m] = monthValue.split("-").map(Number);
      navigate(`${base}${categoryParam}&month=${m}&year=${y}`);
      return;
    }
    navigate(`${base}${categoryParam}`);
  };

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-text-secondary">Controle financeiro</p>
          <h1 className="font-sans text-3xl font-bold">Resumo</h1>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-accent-gold px-4 py-3 text-sm font-bold text-black transition hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          Nova
        </button>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-fit gap-1 rounded-xl bg-bg-muted p-1">
          {(["EXPENSE", "INCOME"] as const).map((t) => {
            const cfg = typeCopy[t];
            const Icon = cfg.icon;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTxType(t)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition",
                  txType === t ? "bg-accent-gold text-black" : "text-text-secondary hover:bg-bg-overlay hover:text-text-primary",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
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
                  : "text-text-secondary hover:bg-bg-overlay hover:text-text-primary",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {period === "daily" && (
          <input
            type="date"
            value={dailyDate}
            onChange={(e) => setDailyDate(e.target.value)}
            className="rounded-xl border border-border-default bg-bg-muted px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold"
          />
        )}

        {period === "weekly" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={weeklyDate}
              onChange={(e) => setWeeklyDate(e.target.value)}
              className="rounded-xl border border-border-default bg-bg-muted px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold"
            />
            <span className="text-xs text-text-secondary">Semana: {weekRangeLabel(weeklyDate)}</span>
          </div>
        )}

        {period === "monthly" && (
          <input
            type="month"
            value={monthValue}
            onChange={(e) => setMonthValue(e.target.value)}
            className="rounded-xl border border-border-default bg-bg-muted px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold"
          />
        )}

        {period === "yearly" && (
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-xl border border-border-default bg-bg-muted px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-gold"
          >
            {YEAR_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )}
      </div>

      {breakdownQuery.isLoading ? (
        <div className="rounded-2xl bg-bg-card p-6">
          <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin text-accent-gold" />
            Carregando categorias...
          </div>
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-2xl bg-bg-card p-8 text-center text-sm text-text-secondary">
          {copy.emptyMessage}
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
          <div className="rounded-2xl bg-bg-card p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
              <copy.icon className={cn("h-4 w-4", copy.accentClass)} />
              {copy.title}
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_240px]">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categories} dataKey="amount" innerRadius={68} outerRadius={96} paddingAngle={2}>
                      {categories.map((category) => (
                        <Cell key={category.id} fill={category.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(Number(value))}
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid rgba(148,163,184,0.2)",
                        borderRadius: 14,
                        color: "#fff",
                      }}
                      labelStyle={{ color: "#fff", fontWeight: 600 }}
                      itemStyle={{ color: "#e5e7eb" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="relative -mt-44 flex h-24 items-center justify-center text-center">
                  <div className="max-w-[160px]">
                    <p className="text-[11px] uppercase tracking-[0.25em] text-text-muted">{copy.topLabel}</p>
                    <p className="text-sm font-semibold text-white">{topCategory?.name ?? "—"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-center gap-3 rounded-2xl bg-bg-muted p-3">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />
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
              <copy.icon className={cn("h-4 w-4", copy.accentClass)} />
            </div>
            <p className="text-xs text-text-secondary">Clique em uma categoria para filtrar as transações.</p>
            <div className="mt-4 space-y-3">
              {categories.map((category) => (
                <CategoryRow key={category.id} category={category} onClick={() => goToTransactions(category.id)} />
              ))}
            </div>
          </aside>
        </div>
      )}

      <TransactionModal open={addOpen} onClose={() => setAddOpen(false)} defaultTab={txType} />
    </section>
  );
}
