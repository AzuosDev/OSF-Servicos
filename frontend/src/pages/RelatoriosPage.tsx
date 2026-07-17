import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { api } from "../lib/api";
import { formatCurrency, localDateString } from "../lib/finance";
import type { AgendaDashboard, CategoryReportRow, DailySummary, ServiceReportRow } from "../types/api";

function formatCompact(value: number) {
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}K`;
  }
  return value.toLocaleString("pt-BR");
}

function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter = formatCurrency,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
  valueFormatter?: (value: number) => string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border-default bg-bg-card p-3 text-sm text-text-primary shadow-xl">
      {label && <p className="mb-2 font-semibold">{label}</p>}
      {payload.map((item) => (
        <p key={item.name} style={{ color: item.color }}>
          {item.name}: {valueFormatter(item.value ?? 0)}
        </p>
      ))}
    </div>
  );
}

function KpiCard({ label, value, valueClassName = "text-white" }: { label: string; value: string; valueClassName?: string }) {
  return (
    <article className="rounded-2xl bg-bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-text-secondary">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${valueClassName}`}>{value}</p>
    </article>
  );
}

function ServiceBarChart({
  data,
  valueKey,
  color,
}: {
  data: ServiceReportRow[];
  valueKey: "count" | "revenue";
  color: string;
}) {
  if (data.length === 0) {
    return <p className="p-4 text-sm text-text-secondary">Sem dados no período.</p>;
  }
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 16, right: 16 }}>
          <XAxis type="number" stroke="#9CA3AF" tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="serviceName" stroke="#9CA3AF" tickLine={false} axisLine={false} width={110} tick={{ fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: "var(--bg-overlay)" }}
            content={<ChartTooltip valueFormatter={valueKey === "revenue" ? formatCurrency : (v) => `${v} serviço(s)`} />}
          />
          <Bar dataKey={valueKey} name={valueKey === "revenue" ? "Receita" : "Qtd."} fill={color} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoryList({ rows }: { rows: CategoryReportRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-text-secondary">Sem dados no período.</p>;
  }
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <div className="space-y-2">
      {rows.slice(0, 6).map((row) => (
        <div key={row.name}>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">{row.name}</span>
            <span className="font-semibold text-white">{formatCurrency(row.total)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-bg-muted">
            <div
              className={`h-1.5 rounded-full ${row.isIncome ? "bg-accent-lime" : "bg-accent-red"}`}
              style={{ width: `${(row.total / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RelatoriosPage() {
  const [date, setDate] = useState(localDateString());

  const summaryQuery = useQuery<DailySummary>({
    queryKey: ["agenda-reports-daily-summary", date],
    queryFn: () => api.get<DailySummary>("/api/agenda-reports/daily-summary", { params: { date } }).then((r) => r.data),
  });

  const dashboardQuery = useQuery<AgendaDashboard>({
    queryKey: ["agenda-reports-dashboard"],
    queryFn: () => api.get<AgendaDashboard>("/api/agenda-reports/dashboard").then((r) => r.data),
  });

  const summary = summaryQuery.data;
  const dashboard = dashboardQuery.data;

  const revenueChartData = (dashboard?.dailyRevenue ?? []).map((p) => ({
    label: p.date.slice(5),
    revenue: p.revenue,
  }));

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-text-secondary">Estética Automotiva</p>
          <h1 className="font-sans text-3xl font-bold">Relatórios</h1>
        </div>
        <label className="flex items-center gap-2">
          <span className="text-sm text-text-secondary">Resumo do dia:</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border border-bg-muted bg-bg-muted px-3 py-2 text-sm text-white outline-none focus:border-accent-lime"
          />
        </label>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total recebido" value={formatCurrency(summary?.totalReceived ?? 0)} valueClassName="text-accent-lime" />
        <KpiCard label="Entradas" value={formatCurrency(summary?.totalIncome ?? 0)} valueClassName="text-accent-lime" />
        <KpiCard label="Saídas" value={formatCurrency(summary?.totalExpense ?? 0)} valueClassName="text-accent-red" />
        <KpiCard
          label="Lucro líquido"
          value={formatCurrency(summary?.netProfit ?? 0)}
          valueClassName={(summary?.netProfit ?? 0) >= 0 ? "text-accent-lime" : "text-accent-red"}
        />
        <KpiCard label="Serviços concluídos" value={String(summary?.servicesCompletedCount ?? 0)} />
        <KpiCard label="Ticket médio" value={formatCurrency(summary?.avgTicket ?? 0)} />
        <KpiCard label="Pagos" value={String(summary?.paidCount ?? 0)} valueClassName="text-accent-lime" />
        <KpiCard label="Pendentes" value={String(summary?.pendingCount ?? 0)} valueClassName="text-accent-red" />
      </div>

      <div className="rounded-2xl bg-bg-card p-4">
        <p className="mb-2 text-xs uppercase tracking-wide text-text-secondary">Painel de hoje</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Entradas hoje" value={formatCurrency(dashboard?.entradasHoje ?? 0)} valueClassName="text-accent-lime" />
          <KpiCard label="Saídas hoje" value={formatCurrency(dashboard?.saidasHoje ?? 0)} valueClassName="text-accent-red" />
          <KpiCard label="Contas pendentes" value={formatCurrency(dashboard?.contasPendentes.value ?? 0)} valueClassName="text-accent-red" />
          <KpiCard label="Agendamentos hoje" value={String(dashboard?.totalAgendamentosHoje ?? 0)} />
        </div>
      </div>

      <div className="rounded-2xl bg-bg-card p-4">
        <p className="mb-2 text-xs uppercase tracking-wide text-text-secondary">Receita diária (últimos 30 dias)</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
              <XAxis dataKey="label" stroke="#9CA3AF" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis stroke="#9CA3AF" tickLine={false} axisLine={false} tickFormatter={formatCompact} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" name="Receita" dataKey="revenue" stroke="#A3E635" fill="#A3E635" fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-bg-card p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-text-secondary">Serviços mais vendidos (30 dias)</p>
          <ServiceBarChart data={dashboard?.topServicesByCount ?? []} valueKey="count" color="#38BDF8" />
        </div>
        <div className="rounded-2xl bg-bg-card p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-text-secondary">Serviços mais lucrativos (30 dias)</p>
          <ServiceBarChart data={dashboard?.topServicesByRevenue ?? []} valueKey="revenue" color="#A3E635" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-bg-card p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-text-secondary">Categorias que mais geram receita</p>
          <CategoryList rows={dashboard?.categoryBreakdown.income ?? []} />
        </div>
        <div className="rounded-2xl bg-bg-card p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-text-secondary">Categorias que mais geram despesa</p>
          <CategoryList rows={dashboard?.categoryBreakdown.expense ?? []} />
        </div>
      </div>
    </section>
  );
}
