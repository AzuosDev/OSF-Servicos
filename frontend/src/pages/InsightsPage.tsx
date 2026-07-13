import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  Loader2,
  Minus,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { formatCurrency } from "../lib/finance";
import { getApiErrorMessages } from "../lib/errors";
import type { InsightsAnnualSummary } from "../types/api";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, index) => CURRENT_YEAR - index);

function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-xs font-medium text-text-secondary">Sem comparação</span>;
  }

  const isPositive = pct > 0;
  const isZero = pct === 0;
  const Icon = isZero ? Minus : isPositive ? ArrowUpRight : ArrowDownRight;
  const colorClass = isZero
    ? "text-text-secondary"
    : isPositive
      ? "text-accent-lime"
      : "text-accent-red";

  return (
    <span className={cn("flex items-center gap-1 text-xs font-semibold", colorClass)}>
      <Icon className="h-3.5 w-3.5" />
      {isPositive && !isZero ? "+" : ""}
      {pct.toFixed(1)}% vs. ano anterior
    </span>
  );
}

function StatCard({
  icon: Icon,
  iconClassName,
  label,
  value,
  changePct,
}: {
  icon: typeof Wallet;
  iconClassName: string;
  label: string;
  value: string;
  changePct: number | null;
}) {
  return (
    <div className="rounded-2xl bg-bg-card p-4">
      <Icon className={cn("mb-4 h-6 w-6", iconClassName)} />
      <strong className="block text-xl">{value}</strong>
      <span className="text-sm text-text-secondary">{label}</span>
      <div className="mt-2">
        <ChangeBadge pct={changePct} />
      </div>
    </div>
  );
}

export function InsightsPage() {
  const [year, setYear] = useState(CURRENT_YEAR);

  const summaryMutation = useMutation({
    mutationFn: async (selectedYear: number) => {
      const { data } = await api.get<InsightsAnnualSummary>("/api/insights/annual-summary", {
        params: { year: selectedYear },
      });
      return data;
    },
  });

  const summary = summaryMutation.data;
  const errorMessages = useMemo(
    () => (summaryMutation.error ? getApiErrorMessages(summaryMutation.error, "Não foi possível gerar o resumo agora. Tente novamente.") : []),
    [summaryMutation.error],
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-text-secondary">Visão geral</p>
          <h1 className="font-sans text-3xl font-bold">Insights</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Resumo anual das suas finanças, com números calculados pelo app e uma explicação gerada por IA.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            className="rounded-xl border border-border-default bg-bg-muted px-3 py-3 text-sm text-text-primary outline-none transition focus:border-accent-lime"
          >
            {YEAR_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <button
            onClick={() => summaryMutation.mutate(year)}
            disabled={summaryMutation.isPending}
            className="flex items-center gap-2 rounded-xl bg-accent-lime px-4 py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {summaryMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Gerar resumo anual
          </button>
        </div>
      </div>

      {summaryMutation.isError && (
        <div className="rounded-2xl border border-accent-red/40 bg-accent-red/10 p-4 text-sm text-accent-red">
          {errorMessages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}

      {!summary && !summaryMutation.isPending && !summaryMutation.isError && (
        <div className="rounded-2xl border border-bg-muted bg-bg-card p-8 text-center">
          <Sparkles className="mx-auto mb-4 h-10 w-10 text-accent-lime" />
          <h2 className="font-sans text-xl font-bold">Ainda não geramos seu resumo</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Escolha um ano e clique em "Gerar resumo anual" para ver médias mensais, comparação com o ano
            anterior e uma explicação em texto.
          </p>
        </div>
      )}

      {summary && summary.noData && (
        <div className="rounded-2xl border border-bg-muted bg-bg-card p-8 text-center">
          <Wallet className="mx-auto mb-4 h-10 w-10 text-text-secondary" />
          <h2 className="font-sans text-xl font-bold">Sem transações em {summary.year}</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Cadastre movimentações nesse ano para conseguirmos calcular médias e gerar um resumo.
          </p>
        </div>
      )}

      {summary && !summary.noData && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatCard
              icon={TrendingUp}
              iconClassName="text-accent-lime"
              label={`Média mensal de ganhos (${summary.current.monthsWithData} ${summary.current.monthsWithData === 1 ? "mês" : "meses"})`}
              value={formatCurrency(summary.current.avgMonthlyIncome)}
              changePct={summary.yoyChange.incomePct}
            />
            <StatCard
              icon={TrendingDown}
              iconClassName="text-accent-red"
              label="Média mensal de gastos"
              value={formatCurrency(summary.current.avgMonthlyExpense)}
              changePct={summary.yoyChange.expensePct}
            />
            <StatCard
              icon={Wallet}
              iconClassName="text-accent-lime"
              label="Saldo médio mensal"
              value={formatCurrency(summary.current.avgMonthlyBalance)}
              changePct={summary.yoyChange.balancePct}
            />
          </div>

          {summary.topCategories.length > 0 && (
            <div className="rounded-2xl bg-bg-card p-5">
              <h2 className="mb-4 font-sans text-xl font-bold">Principais categorias de gasto</h2>
              <div className="space-y-3">
                {summary.topCategories.map((category) => (
                  <div
                    key={category.categoryId ?? category.name}
                    className="flex items-center justify-between gap-3 rounded-xl bg-bg-muted px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{category.name}</p>
                      <p className="text-xs text-text-secondary">
                        {category.percentOfExpenses.toFixed(1)}% dos gastos do ano
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-bold">{formatCurrency(category.total)}</span>
                      <ChangeBadge pct={category.yoyPct} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-accent-lime/10 px-3 py-1 text-xs font-bold text-accent-lime">
                <Sparkles className="h-3.5 w-3.5" />
                Gerado por IA
              </span>
            </div>

            {summary.narrative ? (
              <p className="text-sm leading-relaxed text-text-primary">{summary.narrative}</p>
            ) : (
              <p className="text-sm text-text-secondary">
                Não foi possível gerar o resumo em texto agora. Os números acima continuam corretos — tente
                novamente em instantes.
              </p>
            )}

            <p className="mt-4 text-xs text-text-secondary">
              Este resumo foi gerado por IA com base nos números acima e pode conter imprecisões. Sempre
              confira os valores exatos nos cards.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
