import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeftRight,
  CalendarClock,
  Loader2,
  Tag,
  Target,
} from "lucide-react";
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
import { cn } from "../lib/utils";
import { formatCurrency } from "../lib/finance";
import { getApiErrorMessages } from "../lib/errors";
import type {
  CashflowResult,
  ExpensesBreakdownResult,
  GoalProgress,
  IncomeBreakdownResult,
  InsightsOverview,
} from "../types/api";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, index) => CURRENT_YEAR - index);

function formatPct(pct: number | null) {
  if (pct === null) {
    return "—";
  }

  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

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
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border-default bg-bg-card p-3 text-sm text-text-primary shadow-xl">
      <p className="mb-2 font-semibold">{label}</p>
      {payload.map((item) => (
        <p key={item.name} style={{ color: item.color }}>
          {item.name}: {formatCurrency(item.value ?? 0)}
        </p>
      ))}
    </div>
  );
}

// ─── Aba Visão Geral ────────────────────────────────────────────────────────

const scoreLabelClass: Record<InsightsOverview["healthScore"]["label"], string> = {
  Excelente: "text-accent-lime",
  Boa: "text-accent-lime",
  "Atenção": "text-accent-yellow",
  "Crítica": "text-accent-red",
};

function OverviewCard({
  icon: Icon,
  iconClassName,
  label,
  value,
  valueClassName,
  secondary,
}: {
  icon: typeof Tag;
  iconClassName: string;
  label: string;
  value: string;
  valueClassName?: string;
  secondary?: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-bg-card p-4">
      <Icon className={cn("mb-4 h-6 w-6", iconClassName)} />
      <strong className={cn("block text-xl", valueClassName)}>{value}</strong>
      <span className="text-sm text-text-secondary">{label}</span>
      {secondary && <p className="mt-2 text-xs text-text-secondary">{secondary}</p>}
    </div>
  );
}

function OverviewTab() {
  const [year, setYear] = useState(CURRENT_YEAR);

  const overviewQuery = useQuery<InsightsOverview>({
    queryKey: ["insights-overview", year],
    queryFn: async () => {
      const { data } = await api.get<InsightsOverview>("/api/insights/overview", {
        params: { year },
      });
      return data;
    },
  });

  const errorMessages = overviewQuery.error
    ? getApiErrorMessages(overviewQuery.error, "Não foi possível carregar os insights agora.")
    : [];

  const overview = overviewQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <select
          value={year}
          onChange={(event) => setYear(Number(event.target.value))}
          className="rounded-xl border border-border-default bg-bg-muted px-3 py-3 text-sm text-text-primary outline-none transition focus:border-accent-lime"
          aria-label="Ano para comparação anual"
        >
          {YEAR_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      {overviewQuery.isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-bg-card p-8 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando insights...
        </div>
      )}

      {overviewQuery.isError && (
        <div className="rounded-2xl border border-accent-red/40 bg-accent-red/10 p-4 text-sm text-accent-red">
          {errorMessages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}

      {overview && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <OverviewCard
            icon={Tag}
            iconClassName="text-accent-lime"
            label="Maior categoria de gasto (mês atual)"
            value={overview.topCategoryThisMonth ? overview.topCategoryThisMonth.name : "Sem gastos"}
            secondary={
              overview.topCategoryThisMonth
                ? `${formatCurrency(overview.topCategoryThisMonth.total)} · ${overview.topCategoryThisMonth.percentOfExpenses.toFixed(1)}% dos gastos do mês`
                : "Nenhum gasto registrado este mês"
            }
          />

          <OverviewCard
            icon={ArrowLeftRight}
            iconClassName="text-accent-lime"
            label={`Comparação com ${overview.yoyComparison.previousYear}`}
            value={formatPct(overview.yoyComparison.balancePct)}
            secondary={`Renda ${formatPct(overview.yoyComparison.incomePct)} · Gasto ${formatPct(overview.yoyComparison.expensePct)}`}
          />

          <OverviewCard
            icon={CalendarClock}
            iconClassName="text-accent-lime"
            label="Projeção de fim de mês"
            value={formatCurrency(overview.monthEndProjection.projectedBalance)}
            secondary={`Baseado em ${overview.monthEndProjection.daysElapsed}/${overview.monthEndProjection.daysInMonth} dias · gasto projetado ${formatCurrency(overview.monthEndProjection.projectedExpense)}`}
          />

          <OverviewCard
            icon={Activity}
            iconClassName={scoreLabelClass[overview.healthScore.label]}
            label="Score de saúde financeira"
            value={`${overview.healthScore.score}/100`}
            valueClassName={scoreLabelClass[overview.healthScore.label]}
            secondary={overview.healthScore.label}
          />
        </div>
      )}
    </div>
  );
}

// ─── Filtro de período compartilhado (Fluxo de Caixa, Gastos, Ganhos) ──────

type FilterPeriod = "month" | "quarter" | "year" | "custom";

const PERIOD_LABELS: Record<FilterPeriod, string> = {
  month: "Mês",
  quarter: "Trimestre",
  year: "Ano",
  custom: "Personalizado",
};

function currentYYYYMM() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatPointLabel(dateIso: string, granularity: CashflowResult["granularity"]) {
  const date = new Date(dateIso);
  if (granularity === "month") {
    return date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" });
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

function usePeriodFilter() {
  const [period, setPeriod] = useState<FilterPeriod>("year");
  const [monthValue, setMonthValue] = useState(currentYYYYMM());
  const [quarter, setQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1);
  const [quarterYear, setQuarterYear] = useState(CURRENT_YEAR);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const params = useMemo(() => {
    if (period === "month") {
      const [y, m] = monthValue.split("-").map(Number);
      return { period, year: y, month: m };
    }
    if (period === "quarter") {
      return { period, year: quarterYear, quarter };
    }
    if (period === "custom") {
      return { period, from: customFrom, to: customTo };
    }
    return { period, year };
  }, [period, monthValue, quarter, quarterYear, year, customFrom, customTo]);

  const enabled = period !== "custom" || (customFrom.length > 0 && customTo.length > 0);

  return {
    period,
    setPeriod,
    monthValue,
    setMonthValue,
    quarter,
    setQuarter,
    quarterYear,
    setQuarterYear,
    year,
    setYear,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    params,
    enabled,
  };
}

type PeriodFilterState = ReturnType<typeof usePeriodFilter>;

function PeriodFilterControls(filter: PeriodFilterState) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex w-fit gap-1 rounded-xl bg-bg-muted p-1">
        {(Object.keys(PERIOD_LABELS) as FilterPeriod[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => filter.setPeriod(option)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold transition",
              filter.period === option ? "bg-accent-lime text-black" : "text-text-primary hover:bg-bg-overlay",
            )}
          >
            {PERIOD_LABELS[option]}
          </button>
        ))}
      </div>

      {filter.period === "month" && (
        <input
          type="month"
          value={filter.monthValue}
          onChange={(event) => filter.setMonthValue(event.target.value)}
          className="rounded-xl border border-border-default bg-bg-muted px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-lime"
        />
      )}

      {filter.period === "quarter" && (
        <>
          <select
            value={filter.quarter}
            onChange={(event) => filter.setQuarter(Number(event.target.value))}
            className="rounded-xl border border-border-default bg-bg-muted px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-lime"
          >
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>
                T{q}
              </option>
            ))}
          </select>
          <select
            value={filter.quarterYear}
            onChange={(event) => filter.setQuarterYear(Number(event.target.value))}
            className="rounded-xl border border-border-default bg-bg-muted px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-lime"
          >
            {YEAR_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </>
      )}

      {filter.period === "year" && (
        <select
          value={filter.year}
          onChange={(event) => filter.setYear(Number(event.target.value))}
          className="rounded-xl border border-border-default bg-bg-muted px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-lime"
        >
          {YEAR_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}

      {filter.period === "custom" && (
        <>
          <input
            type="date"
            value={filter.customFrom}
            onChange={(event) => filter.setCustomFrom(event.target.value)}
            className="rounded-xl border border-border-default bg-bg-muted px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-lime"
          />
          <span className="text-sm text-text-secondary">até</span>
          <input
            type="date"
            value={filter.customTo}
            onChange={(event) => filter.setCustomTo(event.target.value)}
            className="rounded-xl border border-border-default bg-bg-muted px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-lime"
          />
        </>
      )}
    </div>
  );
}

// ─── Aba Fluxo de Caixa ─────────────────────────────────────────────────────

function CashflowTab() {
  const filter = usePeriodFilter();

  const cashflowQuery = useQuery<CashflowResult>({
    queryKey: ["insights-cashflow", filter.params],
    queryFn: async () => {
      const { data } = await api.get<CashflowResult>("/api/insights/cashflow", { params: filter.params });
      return data;
    },
    enabled: filter.enabled,
  });

  const errorMessages = cashflowQuery.error
    ? getApiErrorMessages(cashflowQuery.error, "Não foi possível carregar o fluxo de caixa agora.")
    : [];

  const result = cashflowQuery.data;
  const chartData = result?.points.map((point) => ({
    label: formatPointLabel(point.date, result.granularity),
    income: point.income,
    expense: point.expense,
  }));

  return (
    <div className="space-y-6">
      <PeriodFilterControls {...filter} />

      {filter.period === "custom" && !filter.enabled && (
        <p className="text-sm text-text-secondary">Escolha as duas datas para ver o fluxo de caixa.</p>
      )}

      {cashflowQuery.isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-bg-card p-8 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando fluxo de caixa...
        </div>
      )}

      {cashflowQuery.isError && (
        <div className="rounded-2xl border border-accent-red/40 bg-accent-red/10 p-4 text-sm text-accent-red">
          {errorMessages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}

      {result && chartData && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <OverviewCard icon={ArrowLeftRight} iconClassName="text-accent-lime" label="Total de entradas" value={formatCurrency(result.totals.income)} />
            <OverviewCard icon={ArrowLeftRight} iconClassName="text-accent-red" label="Total de saídas" value={formatCurrency(result.totals.expense)} />
            <OverviewCard icon={ArrowLeftRight} iconClassName="text-accent-lime" label="Saldo do período" value={formatCurrency(result.totals.balance)} />
          </div>

          <div className="rounded-2xl bg-bg-card p-5">
            <h2 className="mb-4 font-sans text-xl font-bold">Entradas e saídas</h2>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="cashflowIncomeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#A3E635" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#A3E635" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="cashflowExpenseGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F97316" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                  <XAxis dataKey="label" stroke="#9CA3AF" tickLine={false} axisLine={false} />
                  <YAxis stroke="#9CA3AF" tickLine={false} axisLine={false} tickFormatter={formatCompact} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" name="Entradas" dataKey="income" stroke="#A3E635" fill="url(#cashflowIncomeGradient)" strokeWidth={2} />
                  <Area type="monotone" name="Saídas" dataKey="expense" stroke="#F97316" fill="url(#cashflowExpenseGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Aba Metas ──────────────────────────────────────────────────────────────

function formatMonthKey(key: string) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" });
}

function paceMessage(goal: GoalProgress): string {
  if (goal.completed) {
    return "Meta concluída.";
  }

  const monthlyText = formatCurrency(goal.pace.avgMonthlyContribution);

  if (goal.pace.onTrack === null) {
    return `Contribuição média nos últimos meses: ${monthlyText}/mês (sem prazo definido para comparar o ritmo).`;
  }

  if (goal.pace.onTrack) {
    return `No ritmo atual (${monthlyText}/mês), você deve bater essa meta a tempo.`;
  }

  return `No ritmo atual (${monthlyText}/mês), você não vai bater o prazo — precisaria de ${formatCurrency(goal.pace.requiredMonthlyContribution ?? 0)}/mês.`;
}

function GoalCard({ goal }: { goal: GoalProgress }) {
  const chartData = goal.monthlyContributions.map((point) => ({
    label: formatMonthKey(point.month),
    amount: point.amount,
  }));

  const percent = Math.max(0, Math.min(100, goal.percentComplete));
  const progressColor = goal.completed ? "bg-accent-lime" : percent >= 70 ? "bg-accent-lime" : percent >= 30 ? "bg-accent-yellow" : "bg-accent-red";

  return (
    <div className="rounded-2xl bg-bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-sans text-lg font-bold">{goal.name}</h3>
        {goal.deadline && (
          <span className="text-xs text-text-secondary">
            Prazo: {new Date(goal.deadline).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
          </span>
        )}
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs text-text-secondary">
          <span>{formatCurrency(goal.currentValue)} de {formatCurrency(goal.targetValue)}</span>
          <span>{percent}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-bg-muted">
          <div className={cn("h-full rounded-full transition-all", progressColor)} style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="mt-4 h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <XAxis dataKey="label" stroke="#9CA3AF" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis hide />
            <Tooltip content={<ChartTooltip />} />
            <Bar name="Contribuição" dataKey="amount" fill="#A3E635" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-xs text-text-secondary">{paceMessage(goal)}</p>
    </div>
  );
}

function GoalsTab() {
  const goalsQuery = useQuery<GoalProgress[]>({
    queryKey: ["insights-goals-progress"],
    queryFn: async () => {
      const { data } = await api.get<GoalProgress[]>("/api/insights/goals-progress");
      return data;
    },
  });

  const errorMessages = goalsQuery.error
    ? getApiErrorMessages(goalsQuery.error, "Não foi possível carregar o progresso das metas agora.")
    : [];

  return (
    <div className="space-y-4">
      {goalsQuery.isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-bg-card p-8 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando metas...
        </div>
      )}

      {goalsQuery.isError && (
        <div className="rounded-2xl border border-accent-red/40 bg-accent-red/10 p-4 text-sm text-accent-red">
          {errorMessages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}

      {goalsQuery.data && goalsQuery.data.length === 0 && (
        <div className="rounded-2xl border border-bg-muted bg-bg-card p-8 text-center">
          <Target className="mx-auto mb-4 h-10 w-10 text-text-secondary" />
          <h2 className="font-sans text-xl font-bold">Você ainda não tem metas</h2>
          <p className="mt-2 text-sm text-text-secondary">Crie uma meta financeira para acompanhar o progresso aqui.</p>
        </div>
      )}

      {goalsQuery.data && goalsQuery.data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {goalsQuery.data.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Gráficos de categoria compartilhados (Gastos, Ganhos) ─────────────────

const CATEGORY_COLORS = ["#A3E635", "#F97316", "#38BDF8", "#C084FC", "#FB7185"];
const OUTROS_COLOR = "#6B7280";

function seriesColor(name: string, index: number) {
  return name === "Outros" ? OUTROS_COLOR : CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

function CategoryBarChart({ data, color }: { data: { name: string; total: number }[]; color: string }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 16, right: 16 }}>
          <XAxis type="number" stroke="#9CA3AF" tickLine={false} axisLine={false} tickFormatter={formatCompact} />
          <YAxis type="category" dataKey="name" stroke="#9CA3AF" tickLine={false} axisLine={false} width={100} tick={{ fontSize: 12 }} />
          <Tooltip content={<ChartTooltip />} />
          <Bar name="Total" dataKey="total" fill={color} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoryEvolutionChart({ data, series }: { data: Record<string, string | number>[]; series: string[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
          <XAxis dataKey="label" stroke="#9CA3AF" tickLine={false} axisLine={false} />
          <YAxis stroke="#9CA3AF" tickLine={false} axisLine={false} tickFormatter={formatCompact} />
          <Tooltip content={<ChartTooltip />} />
          {series.map((name, index) => (
            <Area
              key={name}
              type="monotone"
              name={name}
              dataKey={name}
              stackId="1"
              stroke={seriesColor(name, index)}
              fill={seriesColor(name, index)}
              fillOpacity={0.5}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Aba Gastos ─────────────────────────────────────────────────────────────

function GastosTab() {
  const filter = usePeriodFilter();

  const query = useQuery<ExpensesBreakdownResult>({
    queryKey: ["insights-expenses-breakdown", filter.params],
    queryFn: async () => {
      const { data } = await api.get<ExpensesBreakdownResult>("/api/insights/expenses-breakdown", {
        params: filter.params,
      });
      return data;
    },
    enabled: filter.enabled,
  });

  const errorMessages = query.error
    ? getApiErrorMessages(query.error, "Não foi possível carregar os gastos agora.")
    : [];

  const result = query.data;
  const distributionData = result?.byCategory.map((item) => ({ name: item.name, total: item.total }));
  const evolutionData = result?.evolution.map((point) => ({
    label: formatPointLabel(point.date, result.granularity),
    ...point.values,
  }));

  const trend = result?.topCategoryTrend;
  const showTrend = Boolean(trend && trend.momPct !== null && trend.momPct > 0);

  return (
    <div className="space-y-6">
      <PeriodFilterControls {...filter} />

      {filter.period === "custom" && !filter.enabled && (
        <p className="text-sm text-text-secondary">Escolha as duas datas para ver os gastos.</p>
      )}

      {query.isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-bg-card p-8 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando gastos...
        </div>
      )}

      {query.isError && (
        <div className="rounded-2xl border border-accent-red/40 bg-accent-red/10 p-4 text-sm text-accent-red">
          {errorMessages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}

      {result && distributionData && evolutionData && (
        <>
          {distributionData.length === 0 ? (
            <div className="rounded-2xl border border-bg-muted bg-bg-card p-8 text-center text-sm text-text-secondary">
              Nenhum gasto categorizado nesse período.
            </div>
          ) : (
            <>
              <div className="rounded-2xl bg-bg-card p-5">
                <h2 className="mb-4 font-sans text-xl font-bold">Distribuição por categoria</h2>
                <CategoryBarChart data={distributionData} color="#F97316" />
              </div>

              <div className="rounded-2xl bg-bg-card p-5">
                <h2 className="mb-4 font-sans text-xl font-bold">Evolução por categoria</h2>
                <CategoryEvolutionChart data={evolutionData} series={result.evolutionSeries} />
              </div>
            </>
          )}

          {showTrend && trend && (
            <p className="rounded-2xl bg-bg-card p-4 text-sm text-text-secondary">
              Categoria <strong className="text-text-primary">{trend.name}</strong> cresceu{" "}
              {trend.momPct?.toFixed(1)}% em relação ao mês anterior.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Aba Ganhos ─────────────────────────────────────────────────────────────

function GanhosTab() {
  const filter = usePeriodFilter();

  const query = useQuery<IncomeBreakdownResult>({
    queryKey: ["insights-income-breakdown", filter.params],
    queryFn: async () => {
      const { data } = await api.get<IncomeBreakdownResult>("/api/insights/income-breakdown", {
        params: filter.params,
      });
      return data;
    },
    enabled: filter.enabled,
  });

  const errorMessages = query.error
    ? getApiErrorMessages(query.error, "Não foi possível carregar os ganhos agora.")
    : [];

  const result = query.data;
  const sourceData = result?.bySource.map((item) => ({ name: item.name, total: item.total }));
  const consistencyData = result?.monthlyConsistency.map((point) => ({
    label: formatMonthKey(point.month),
    total: point.total,
  }));

  return (
    <div className="space-y-6">
      <PeriodFilterControls {...filter} />

      {filter.period === "custom" && !filter.enabled && (
        <p className="text-sm text-text-secondary">Escolha as duas datas para ver os ganhos.</p>
      )}

      {query.isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-bg-card p-8 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando ganhos...
        </div>
      )}

      {query.isError && (
        <div className="rounded-2xl border border-accent-red/40 bg-accent-red/10 p-4 text-sm text-accent-red">
          {errorMessages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}

      {result && sourceData && consistencyData && (
        <>
          {sourceData.length === 0 ? (
            <div className="rounded-2xl border border-bg-muted bg-bg-card p-8 text-center text-sm text-text-secondary">
              Nenhuma renda categorizada nesse período.
            </div>
          ) : (
            <div className="rounded-2xl bg-bg-card p-5">
              <h2 className="mb-4 font-sans text-xl font-bold">Fontes de renda</h2>
              <CategoryBarChart data={sourceData} color="#A3E635" />
            </div>
          )}

          <div className="rounded-2xl bg-bg-card p-5">
            <h2 className="mb-4 font-sans text-xl font-bold">Consistência mês a mês</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={consistencyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                  <XAxis dataKey="label" stroke="#9CA3AF" tickLine={false} axisLine={false} />
                  <YAxis stroke="#9CA3AF" tickLine={false} axisLine={false} tickFormatter={formatCompact} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar name="Renda" dataKey="total" fill="#A3E635" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {result.consistency && (
            <p className="rounded-2xl bg-bg-card p-4 text-sm text-text-secondary">
              Sua renda variou {formatPct(result.consistency.variationPct)} em relação à média dos últimos{" "}
              {result.consistency.monthsWithData} meses.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Shell com abas ─────────────────────────────────────────────────────────

type InsightsTab = "overview" | "cashflow" | "goals" | "gastos" | "ganhos";

const TABS: { id: InsightsTab; label: string }[] = [
  { id: "overview", label: "Visão Geral" },
  { id: "cashflow", label: "Fluxo de Caixa" },
  { id: "goals", label: "Metas" },
  { id: "gastos", label: "Gastos" },
  { id: "ganhos", label: "Ganhos" },
];

export function InsightsPage() {
  const [activeTab, setActiveTab] = useState<InsightsTab>("overview");

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-text-secondary">Análise</p>
        <h1 className="font-sans text-3xl font-bold">Insights</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Indicadores e gráficos calculados automaticamente a partir das suas movimentações.
        </p>
      </div>

      <div className="flex w-fit gap-1 rounded-xl bg-bg-muted p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold transition",
              activeTab === tab.id ? "bg-accent-lime text-black" : "text-text-primary hover:bg-bg-overlay",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "cashflow" && <CashflowTab />}
      {activeTab === "goals" && <GoalsTab />}
      {activeTab === "gastos" && <GastosTab />}
      {activeTab === "ganhos" && <GanhosTab />}
    </section>
  );
}
