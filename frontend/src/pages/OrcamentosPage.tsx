import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileText, Plus, TrendingUp, Wallet } from "lucide-react";

import { api } from "../lib/api";
import { formatCurrency } from "../lib/finance";
import { BUDGET_STATUS_BADGE_CLASS, BUDGET_STATUS_LABEL } from "../lib/orcamentos";
import { cn } from "../lib/utils";
import type { Budget, BudgetConversionStats, BudgetsListResponse, BudgetStatus, Client } from "../types/api";

const STATUS_FILTERS: (BudgetStatus | "TODOS")[] = [
  "TODOS",
  "RASCUNHO",
  "ENVIADO",
  "APROVADO",
  "REJEITADO",
  "EXPIRADO",
  "CANCELADO",
];

function formatDateBR(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function OrcamentosPage() {
  const [status, setStatus] = useState<BudgetStatus | "TODOS">("TODOS");

  const statsQuery = useQuery<BudgetConversionStats>({
    queryKey: ["orcamentos-conversion-stats"],
    queryFn: () => api.get<BudgetConversionStats>("/api/orcamentos/budgets/stats/conversion").then((r) => r.data),
  });

  const budgetsQuery = useQuery<BudgetsListResponse>({
    queryKey: ["orcamentos-budgets", status],
    queryFn: () =>
      api
        .get<BudgetsListResponse>("/api/orcamentos/budgets", {
          params: { limit: 20, ...(status !== "TODOS" && { status }) },
        })
        .then((r) => r.data),
  });

  const clientsQuery = useQuery<Client[]>({
    queryKey: ["orcamentos-clients"],
    queryFn: () => api.get<Client[]>("/api/orcamentos/clients").then((r) => r.data),
  });

  const clientNameById = useMemo(() => {
    const map = new Map<string, string>();
    (clientsQuery.data ?? []).forEach((c) => map.set(c._id, c.name));
    return map;
  }, [clientsQuery.data]);

  const stats = statsQuery.data;
  const budgets = budgetsQuery.data?.items ?? [];
  const ticketMedio = stats && stats.approved > 0 ? stats.totalValueApproved / stats.approved : 0;
  const conversionPct = stats ? Math.round(stats.conversionRate * 100) : 0;

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-sm text-text-secondary">Orçamentos</p>
          <h1 className="font-sans text-3xl font-bold">Conversão</h1>
        </div>
        <Link
          to="/orcamentos/novo"
          className="inline-flex items-center gap-2 rounded-xl bg-accent-gold px-4 py-3 text-sm font-bold text-black transition hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          Novo Orçamento
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-2 rounded-2xl border border-border-default bg-bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Total de orçamentos
            </span>
            <FileText className="h-4 w-4 text-text-secondary" />
          </div>
          <span className="font-sans text-3xl font-extrabold">{stats?.total ?? "–"}</span>
          <span className="text-xs text-text-secondary">no total</span>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl border border-border-default bg-bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Taxa de conversão
            </span>
            <TrendingUp className="h-4 w-4 text-accent-green" />
          </div>
          <span className="font-sans text-3xl font-extrabold text-accent-green">{conversionPct}%</span>
          <span className="text-xs text-text-secondary">aprovados / enviados</span>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl border border-border-default bg-bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Ticket médio</span>
            <Wallet className="h-4 w-4 text-text-secondary" />
          </div>
          <span className="font-sans text-3xl font-extrabold">{formatCurrency(ticketMedio)}</span>
          <span className="text-xs text-text-secondary">por orçamento aprovado</span>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl border border-border-default bg-bg-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Valor aprovado</span>
            <Wallet className="h-4 w-4 text-accent-gold" />
          </div>
          <span className="font-sans text-3xl font-extrabold text-accent-gold">
            {formatCurrency(stats?.totalValueApproved ?? 0)}
          </span>
          <span className="text-xs text-text-secondary">total aprovado</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setStatus(filter)}
            className={cn(
              "rounded-full px-4 py-2 text-xs font-semibold transition",
              status === filter
                ? "bg-accent-gold text-black"
                : "bg-bg-muted text-text-secondary hover:bg-bg-overlay hover:text-text-primary",
            )}
          >
            {filter === "TODOS" ? "Todos" : BUDGET_STATUS_LABEL[filter]}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border-default bg-bg-card">
        {budgetsQuery.isLoading ? (
          <div className="p-6 text-sm text-text-secondary">Carregando orçamentos...</div>
        ) : budgets.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="mx-auto h-10 w-10 text-accent-gold" />
            <h2 className="mt-4 text-xl font-semibold text-white">Nenhum orçamento encontrado</h2>
            <p className="mt-2 text-sm text-text-secondary">
              {status === "TODOS" ? "Crie o primeiro orçamento para começar." : "Nenhum orçamento com este status."}
            </p>
          </div>
        ) : (
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border-default text-left text-xs font-bold uppercase tracking-wide text-text-secondary">
                <th className="px-5 py-3">№</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Data</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((budget: Budget) => (
                <tr key={budget._id} className="border-b border-border-default last:border-none">
                  <td className="px-5 py-4 font-bold text-text-secondary">
                    #{String(budget.sequenceNumber).padStart(4, "0")}
                  </td>
                  <td className="px-5 py-4 font-semibold">
                    {clientNameById.get(budget.clientId) ?? "—"}
                  </td>
                  <td className="px-5 py-4 text-text-secondary">
                    {budget.createdAt ? formatDateBR(budget.createdAt) : "—"}
                  </td>
                  <td className="px-5 py-4 font-bold">{formatCurrency(budget.total)}</td>
                  <td className="px-5 py-4">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-3 py-1 text-xs font-bold",
                        BUDGET_STATUS_BADGE_CLASS[budget.status],
                      )}
                    >
                      {BUDGET_STATUS_LABEL[budget.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
