import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeftRight,
  CalendarClock,
  Clock,
  FileText,
  Landmark,
  Loader2,
  Repeat,
  Tag,
  Target,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
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
  AccountsOverview,
  CashflowResult,
  ExpensesBreakdownResult,
  GoalProgress,
  IncomeBreakdownResult,
  InsightsAnnualAggregates,
  InsightsOverview,
  WalletEvolution,
} from "../types/api";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, index) => CURRENT_YEAR - index);

function monthYearLabel(month: number, year: number) {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
}

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

function CashflowPreview({ onNavigate }: { onNavigate: () => void }) {
  const query = useQuery<CashflowResult>({
    queryKey: ["insights-cashflow-preview"],
    queryFn: async () => {
      const { data } = await api.get<CashflowResult>("/api/insights/cashflow", { params: { period: "year" } });
      return data;
    },
  });

  const result = query.data;
  const recentPoints = result ? result.points.slice(-6) : [];
  const chartData = result
    ? recentPoints.map((point) => ({
        label: formatPointLabel(point.date, result.granularity),
        income: point.income,
        expense: point.expense,
      }))
    : [];
  const recentTotals = recentPoints.reduce(
    (acc, point) => ({ income: acc.income + point.income, expense: acc.expense + point.expense }),
    { income: 0, expense: 0 },
  );

  return (
    <div className="rounded-2xl bg-bg-card p-5">
      <h2 className="mb-3 font-sans text-lg font-bold">Fluxo de Caixa</h2>

      {query.isLoading && (
        <div className="flex h-40 items-center justify-center text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}

      {result && (
        <>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <Area type="monotone" dataKey="income" stroke="#A3E635" fill="#A3E635" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="expense" stroke="#F97316" fill="#F97316" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-text-secondary">
            Entradas {formatCurrency(recentTotals.income)} · Saídas {formatCurrency(recentTotals.expense)}
          </p>
        </>
      )}

      <button type="button" onClick={onNavigate} className="mt-3 text-sm font-semibold text-accent-lime hover:underline">
        Ver mais →
      </button>
    </div>
  );
}

function GoalsPreview({ onNavigate }: { onNavigate: () => void }) {
  const query = useQuery<GoalProgress[]>({
    queryKey: ["insights-goals-progress"],
    queryFn: async () => {
      const { data } = await api.get<GoalProgress[]>("/api/insights/goals-progress");
      return data;
    },
  });

  const goals = query.data ?? [];
  const onTrackCount = goals.filter((goal) => goal.completed || goal.pace.onTrack !== false).length;
  const featured = [...goals]
    .filter((goal) => !goal.completed)
    .sort((a, b) => {
      if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return a.percentComplete - b.percentComplete;
    })[0];

  return (
    <div className="rounded-2xl bg-bg-card p-5">
      <h2 className="mb-3 font-sans text-lg font-bold">Metas</h2>

      {query.isLoading && (
        <div className="flex h-40 items-center justify-center text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}

      {query.data && goals.length === 0 && <p className="text-sm text-text-secondary">Você ainda não tem metas.</p>}

      {query.data && goals.length > 0 && (
        <>
          <p className="text-sm text-text-secondary">
            {onTrackCount} de {goals.length} meta{goals.length > 1 ? "s" : ""} no ritmo certo
          </p>

          {featured && (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-xs text-text-secondary">
                <span className="truncate">{featured.name}</span>
                <span>{featured.percentComplete}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-bg-muted">
                <div
                  className="h-full rounded-full bg-accent-lime transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, featured.percentComplete))}%` }}
                />
              </div>
            </div>
          )}
        </>
      )}

      <button type="button" onClick={onNavigate} className="mt-3 text-sm font-semibold text-accent-lime hover:underline">
        Ver mais →
      </button>
    </div>
  );
}

function ContasPreview({ onNavigate }: { onNavigate: () => void }) {
  const query = useQuery<AccountsOverview>({
    queryKey: ["insights-accounts-overview"],
    queryFn: async () => {
      const { data } = await api.get<AccountsOverview>("/api/insights/accounts-overview");
      return data;
    },
  });

  const result = query.data;

  return (
    <div className="rounded-2xl bg-bg-card p-5">
      <h2 className="mb-3 font-sans text-lg font-bold">Contas — vencendo essa semana</h2>

      {query.isLoading && (
        <div className="flex h-10 items-center gap-2 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}

      {result && (
        <p className="text-sm text-text-secondary">
          {result.dueThisWeek.count === 0
            ? "Nenhuma conta vencendo essa semana."
            : `${result.dueThisWeek.count} conta${result.dueThisWeek.count > 1 ? "s" : ""} somando ${formatCurrency(result.dueThisWeek.value)}.`}
        </p>
      )}

      <button type="button" onClick={onNavigate} className="mt-3 text-sm font-semibold text-accent-lime hover:underline">
        Ver mais →
      </button>
    </div>
  );
}

function OverviewTab({ onNavigateTab }: { onNavigateTab: (tab: InsightsTab) => void }) {
  const overviewQuery = useQuery<InsightsOverview>({
    queryKey: ["insights-overview"],
    queryFn: async () => {
      const { data } = await api.get<InsightsOverview>("/api/insights/overview");
      return data;
    },
  });

  const errorMessages = overviewQuery.error
    ? getApiErrorMessages(overviewQuery.error, "Não foi possível carregar os insights agora.")
    : [];

  const overview = overviewQuery.data;

  return (
    <div className="space-y-6">
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
            label="Comparação mensal"
            value={
              overview.monthComparison.hasPreviousMonthData
                ? `Renda ${formatPct(overview.monthComparison.incomePct)} · Gasto ${formatPct(overview.monthComparison.expensePct)}`
                : "—"
            }
            secondary={
              overview.monthComparison.hasPreviousMonthData
                ? `${monthYearLabel(overview.monthComparison.currentMonth, overview.monthComparison.currentYear)} vs. ${monthYearLabel(overview.monthComparison.previousMonth, overview.monthComparison.previousYear)}`
                : "Ainda sem dados do mês anterior para comparar"
            }
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

      {overview && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CashflowPreview onNavigate={() => onNavigateTab("cashflow")} />
            <GoalsPreview onNavigate={() => onNavigateTab("goals")} />
          </div>

          <ContasPreview onNavigate={() => onNavigateTab("contas")} />
        </>
      )}

      <PersonalizedReportSection />
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

function CashflowChart({ data }: { data: { label: string; income: number; expense: number }[] }) {
  return (
    <div className="rounded-2xl bg-bg-card p-5">
      <h2 className="mb-4 font-sans text-xl font-bold">Entradas e saídas</h2>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
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
  );
}

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

          <CashflowChart data={chartData} />
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

// Hash determinístico (djb2) só pra escolher um slot de cor preferido por NOME — não depende de
// posição/ranking, então a mesma categoria mantém a mesma cor mesmo trocando de posição no
// ranking de gasto entre períodos (bug anterior: cor vinha de `index`, então a cor de uma
// categoria mudava sempre que ela subia/descia no ranking de um mês pro outro).
function hashString(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// Resolve colisões (duas categorias com o mesmo slot preferido) de forma determinística:
// ordena por nome e sonda o próximo slot livre. Garante que categorias exibidas juntas no mesmo
// gráfico nunca dividem a mesma cor — o máximo de séries reais simultâneas é 5 (top 5 + Outros
// à parte), igual ao tamanho da paleta, então sempre existe um slot livre pra sondar.
function assignCategoryColors(names: string[]): Map<string, string> {
  const colorByName = new Map<string, string>();
  const realNames = [...names].filter((name) => name !== "Outros").sort();
  const usedSlots = new Set<number>();

  for (const name of realNames) {
    let slot = hashString(name) % CATEGORY_COLORS.length;
    while (usedSlots.has(slot)) {
      slot = (slot + 1) % CATEGORY_COLORS.length;
    }
    usedSlots.add(slot);
    colorByName.set(name, CATEGORY_COLORS[slot]);
  }

  if (names.includes("Outros")) {
    colorByName.set("Outros", OUTROS_COLOR);
  }

  return colorByName;
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
  const colorByName = useMemo(() => assignCategoryColors(series), [series]);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
          <XAxis dataKey="label" stroke="#9CA3AF" tickLine={false} axisLine={false} />
          <YAxis stroke="#9CA3AF" tickLine={false} axisLine={false} tickFormatter={formatCompact} />
          <Tooltip content={<ChartTooltip />} />
          {series.map((name) => (
            <Area
              key={name}
              type="monotone"
              name={name}
              dataKey={name}
              stackId="1"
              stroke={colorByName.get(name)}
              fill={colorByName.get(name)}
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

function IncomeConsistencyChart({ data }: { data: { label: string; total: number }[] }) {
  return (
    <div className="rounded-2xl bg-bg-card p-5">
      <h2 className="mb-4 font-sans text-xl font-bold">Consistência mês a mês</h2>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
            <XAxis dataKey="label" stroke="#9CA3AF" tickLine={false} axisLine={false} />
            <YAxis stroke="#9CA3AF" tickLine={false} axisLine={false} tickFormatter={formatCompact} />
            <Tooltip content={<ChartTooltip />} />
            <Bar name="Renda" dataKey="total" fill="#A3E635" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

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

          <IncomeConsistencyChart data={consistencyData} />

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

// ─── Aba Contas ─────────────────────────────────────────────────────────────

function InstallmentRow({ item }: { item: AccountsOverview["installmentsInProgress"][number] }) {
  const percent = item.totalParcelas > 0 ? Math.round((item.paidParcelas / item.totalParcelas) * 100) : 0;

  return (
    <div className="rounded-xl bg-bg-muted p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{item.title}</p>
        <span className="text-xs text-text-secondary">
          {item.paidParcelas}/{item.totalParcelas} parcelas
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-bg-overlay">
        <div className="h-full rounded-full bg-accent-lime transition-all" style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-text-secondary">
        <span>{formatCurrency(item.valorParcela)}/parcela</span>
        <span>Próxima: {new Date(item.nextDueDate).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</span>
      </div>
    </div>
  );
}

function ContasTab() {
  const query = useQuery<AccountsOverview>({
    queryKey: ["insights-accounts-overview"],
    queryFn: async () => {
      const { data } = await api.get<AccountsOverview>("/api/insights/accounts-overview");
      return data;
    },
  });

  const errorMessages = query.error
    ? getApiErrorMessages(query.error, "Não foi possível carregar as contas agora.")
    : [];

  const result = query.data;

  return (
    <div className="space-y-6">
      {query.isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-bg-card p-8 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando contas...
        </div>
      )}

      {query.isError && (
        <div className="rounded-2xl border border-accent-red/40 bg-accent-red/10 p-4 text-sm text-accent-red">
          {errorMessages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}

      {result && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <OverviewCard
              icon={Clock}
              iconClassName="text-accent-lime"
              label="Pagas"
              value={formatCurrency(result.paidVsPending.paidValue)}
              secondary={`${result.paidVsPending.paidCount} conta(s)`}
            />
            <OverviewCard
              icon={Clock}
              iconClassName="text-accent-yellow"
              label="Pendentes"
              value={formatCurrency(result.paidVsPending.pendingValue)}
              secondary={`${result.paidVsPending.pendingCount} conta(s)`}
            />
            <OverviewCard
              icon={Repeat}
              iconClassName="text-accent-lime"
              label="Recorrentes ativas"
              value={String(result.activeRecurringCount)}
            />
          </div>

          {result.overdue.count > 0 && (
            <p className="rounded-2xl border border-accent-red/40 bg-accent-red/10 p-4 text-sm text-accent-red">
              {result.overdue.count} conta{result.overdue.count > 1 ? "s" : ""} em atraso somando{" "}
              {formatCurrency(result.overdue.value)}.
            </p>
          )}

          <div className="rounded-2xl bg-bg-card p-5">
            <h2 className="mb-4 font-sans text-xl font-bold">Parcelamentos em andamento</h2>
            {result.installmentsInProgress.length === 0 ? (
              <p className="text-sm text-text-secondary">Nenhum parcelamento em andamento.</p>
            ) : (
              <div className="space-y-3">
                {result.installmentsInProgress.map((item) => (
                  <InstallmentRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Aba Carteiras ──────────────────────────────────────────────────────────

function monthKeyFromIso(iso: string) {
  const date = new Date(iso);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function WalletsChart({
  wallets,
  data,
}: {
  wallets: WalletEvolution[];
  data: Record<string, string | number | null>[];
}) {
  const colorByName = useMemo(() => assignCategoryColors(wallets.map((wallet) => wallet.nome)), [wallets]);

  return (
    <div className="rounded-2xl bg-bg-card p-5">
      <h2 className="mb-4 font-sans text-xl font-bold">Evolução de saldo</h2>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
            <XAxis dataKey="label" stroke="#9CA3AF" tickLine={false} axisLine={false} />
            <YAxis stroke="#9CA3AF" tickLine={false} axisLine={false} tickFormatter={formatCompact} />
            <Tooltip content={<ChartTooltip />} />
            {wallets.map((wallet) => (
              <Line
                key={wallet.id}
                type="monotone"
                name={wallet.nome}
                dataKey={wallet.nome}
                stroke={colorByName.get(wallet.nome)}
                strokeWidth={2}
                connectNulls={false}
                dot={{ r: 3, strokeWidth: 0, fill: colorByName.get(wallet.nome) }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CarteirasTab() {
  const query = useQuery<WalletEvolution[]>({
    queryKey: ["insights-wallets-evolution"],
    queryFn: async () => {
      const { data } = await api.get<WalletEvolution[]>("/api/insights/wallets-evolution");
      return data;
    },
  });

  const errorMessages = query.error
    ? getApiErrorMessages(query.error, "Não foi possível carregar as carteiras agora.")
    : [];

  const wallets = query.data ?? [];
  const chartData = wallets[0]?.points.map((_, index) => {
    const point: Record<string, string | number | null> = {
      label: formatMonthKey(monthKeyFromIso(wallets[0].points[index].date)),
    };
    wallets.forEach((wallet) => {
      point[wallet.nome] = wallet.points[index]?.balance ?? null;
    });
    return point;
  });

  return (
    <div className="space-y-6">
      {query.isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-bg-card p-8 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando carteiras...
        </div>
      )}

      {query.isError && (
        <div className="rounded-2xl border border-accent-red/40 bg-accent-red/10 p-4 text-sm text-accent-red">
          {errorMessages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}

      {query.data && wallets.length === 0 && (
        <div className="rounded-2xl border border-bg-muted bg-bg-card p-8 text-center">
          <Landmark className="mx-auto mb-4 h-10 w-10 text-text-secondary" />
          <h2 className="font-sans text-xl font-bold">Você ainda não tem carteiras</h2>
          <p className="mt-2 text-sm text-text-secondary">Crie uma carteira para acompanhar a evolução do saldo aqui.</p>
        </div>
      )}

      {wallets.length > 0 && chartData && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {wallets.map((wallet) => (
              <OverviewCard
                key={wallet.id}
                icon={Landmark}
                iconClassName="text-accent-lime"
                label={wallet.nome}
                value={formatCurrency(wallet.currentBalance)}
              />
            ))}
          </div>

          <WalletsChart wallets={wallets} data={chartData} />
        </>
      )}
    </div>
  );
}

// ─── Relatório Personalizado (aba Visão Geral) ─────────────────────────────

type ReportSectionId = "cashflow" | "goals" | "gastos" | "ganhos" | "contas" | "carteiras" | "annual";

const REPORT_SECTIONS: { id: ReportSectionId; label: string }[] = [
  { id: "cashflow", label: "Fluxo de Caixa" },
  { id: "goals", label: "Metas" },
  { id: "gastos", label: "Gastos" },
  { id: "ganhos", label: "Ganhos" },
  { id: "contas", label: "Contas" },
  { id: "carteiras", label: "Carteiras" },
  { id: "annual", label: "Média Anual" },
];

type GeneratedReportConfig = {
  sections: ReportSectionId[];
  params: PeriodFilterState["params"];
  year: number;
};

function ReportSectionCard({
  title,
  isLoading,
  isError,
  errorMessages,
  loadingLabel,
  children,
}: {
  title: string;
  isLoading: boolean;
  isError: boolean;
  errorMessages: string[];
  loadingLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-border-default bg-bg-card p-5">
      <h3 className="font-sans text-lg font-bold">{title}</h3>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-bg-muted p-6 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingLabel}
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-accent-red/40 bg-accent-red/10 p-4 text-sm text-accent-red">
          {errorMessages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}

      {!isLoading && !isError && children}
    </div>
  );
}

function ReportCashflowSection({ params }: { params: PeriodFilterState["params"] }) {
  const query = useQuery<CashflowResult>({
    queryKey: ["report-cashflow", params],
    queryFn: async () => {
      const { data } = await api.get<CashflowResult>("/api/insights/cashflow", { params });
      return data;
    },
  });

  const errorMessages = query.error
    ? getApiErrorMessages(query.error, "Não foi possível carregar o fluxo de caixa.")
    : [];
  const result = query.data;
  const chartData = result?.points.map((point) => ({
    label: formatPointLabel(point.date, result.granularity),
    income: point.income,
    expense: point.expense,
  }));

  return (
    <ReportSectionCard
      title="Fluxo de Caixa"
      isLoading={query.isLoading}
      isError={query.isError}
      errorMessages={errorMessages}
      loadingLabel="Carregando fluxo de caixa..."
    >
      {result && chartData && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <OverviewCard icon={ArrowLeftRight} iconClassName="text-accent-lime" label="Entradas" value={formatCurrency(result.totals.income)} />
            <OverviewCard icon={ArrowLeftRight} iconClassName="text-accent-red" label="Saídas" value={formatCurrency(result.totals.expense)} />
            <OverviewCard icon={ArrowLeftRight} iconClassName="text-accent-lime" label="Saldo" value={formatCurrency(result.totals.balance)} />
          </div>
          <CashflowChart data={chartData} />
        </>
      )}
    </ReportSectionCard>
  );
}

function ReportGoalsSection({ params }: { params: PeriodFilterState["params"] }) {
  const query = useQuery<GoalProgress[]>({
    queryKey: ["report-goals-progress", params],
    queryFn: async () => {
      const { data } = await api.get<GoalProgress[]>("/api/insights/goals-progress", { params });
      return data;
    },
  });

  const errorMessages = query.error
    ? getApiErrorMessages(query.error, "Não foi possível carregar as metas.")
    : [];
  const goals = query.data ?? [];

  return (
    <ReportSectionCard
      title="Metas"
      isLoading={query.isLoading}
      isError={query.isError}
      errorMessages={errorMessages}
      loadingLabel="Carregando metas..."
    >
      {goals.length === 0 ? (
        <p className="text-sm text-text-secondary">Nenhuma meta cadastrada.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      )}
    </ReportSectionCard>
  );
}

function ReportGastosSection({ params }: { params: PeriodFilterState["params"] }) {
  const query = useQuery<ExpensesBreakdownResult>({
    queryKey: ["report-expenses-breakdown", params],
    queryFn: async () => {
      const { data } = await api.get<ExpensesBreakdownResult>("/api/insights/expenses-breakdown", { params });
      return data;
    },
  });

  const errorMessages = query.error
    ? getApiErrorMessages(query.error, "Não foi possível carregar os gastos.")
    : [];
  const result = query.data;
  const distributionData = result?.byCategory.map((item) => ({ name: item.name, total: item.total }));
  const evolutionData = result?.evolution.map((point) => ({
    label: formatPointLabel(point.date, result.granularity),
    ...point.values,
  }));

  return (
    <ReportSectionCard
      title="Gastos"
      isLoading={query.isLoading}
      isError={query.isError}
      errorMessages={errorMessages}
      loadingLabel="Carregando gastos..."
    >
      {result && distributionData && evolutionData && (
        distributionData.length === 0 ? (
          <p className="text-sm text-text-secondary">Nenhum gasto categorizado nesse período.</p>
        ) : (
          <>
            <CategoryBarChart data={distributionData} color="#F97316" />
            <CategoryEvolutionChart data={evolutionData} series={result.evolutionSeries} />
          </>
        )
      )}
    </ReportSectionCard>
  );
}

function ReportGanhosSection({ params }: { params: PeriodFilterState["params"] }) {
  const query = useQuery<IncomeBreakdownResult>({
    queryKey: ["report-income-breakdown", params],
    queryFn: async () => {
      const { data } = await api.get<IncomeBreakdownResult>("/api/insights/income-breakdown", { params });
      return data;
    },
  });

  const errorMessages = query.error
    ? getApiErrorMessages(query.error, "Não foi possível carregar os ganhos.")
    : [];
  const result = query.data;
  const sourceData = result?.bySource.map((item) => ({ name: item.name, total: item.total }));
  const consistencyData = result?.monthlyConsistency.map((point) => ({
    label: formatMonthKey(point.month),
    total: point.total,
  }));

  return (
    <ReportSectionCard
      title="Ganhos"
      isLoading={query.isLoading}
      isError={query.isError}
      errorMessages={errorMessages}
      loadingLabel="Carregando ganhos..."
    >
      {result && sourceData && consistencyData && (
        <>
          {sourceData.length === 0 ? (
            <p className="text-sm text-text-secondary">Nenhuma renda categorizada nesse período.</p>
          ) : (
            <CategoryBarChart data={sourceData} color="#A3E635" />
          )}
          <IncomeConsistencyChart data={consistencyData} />
          {result.consistency && (
            <p className="text-sm text-text-secondary">
              Renda variou {formatPct(result.consistency.variationPct)} em relação à média dos últimos{" "}
              {result.consistency.monthsWithData} meses.
            </p>
          )}
        </>
      )}
    </ReportSectionCard>
  );
}

function ReportContasSection() {
  const query = useQuery<AccountsOverview>({
    queryKey: ["report-accounts-overview"],
    queryFn: async () => {
      const { data } = await api.get<AccountsOverview>("/api/insights/accounts-overview");
      return data;
    },
  });

  const errorMessages = query.error
    ? getApiErrorMessages(query.error, "Não foi possível carregar as contas.")
    : [];
  const result = query.data;

  return (
    <ReportSectionCard
      title="Contas"
      isLoading={query.isLoading}
      isError={query.isError}
      errorMessages={errorMessages}
      loadingLabel="Carregando contas..."
    >
      {result && (
        <>
          <p className="text-xs text-text-secondary">
            Dados de hoje — esta seção não respeita o período escolhido no relatório.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <OverviewCard
              icon={Clock}
              iconClassName="text-accent-lime"
              label="Pagas"
              value={formatCurrency(result.paidVsPending.paidValue)}
              secondary={`${result.paidVsPending.paidCount} conta(s)`}
            />
            <OverviewCard
              icon={Clock}
              iconClassName="text-accent-yellow"
              label="Pendentes"
              value={formatCurrency(result.paidVsPending.pendingValue)}
              secondary={`${result.paidVsPending.pendingCount} conta(s)`}
            />
            <OverviewCard icon={Repeat} iconClassName="text-accent-lime" label="Recorrentes ativas" value={String(result.activeRecurringCount)} />
          </div>

          {result.overdue.count > 0 && (
            <p className="rounded-xl border border-accent-red/40 bg-accent-red/10 p-3 text-sm text-accent-red">
              {result.overdue.count} conta{result.overdue.count > 1 ? "s" : ""} em atraso somando{" "}
              {formatCurrency(result.overdue.value)}.
            </p>
          )}

          {result.installmentsInProgress.length > 0 && (
            <div className="space-y-3">
              {result.installmentsInProgress.map((item) => (
                <InstallmentRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </>
      )}
    </ReportSectionCard>
  );
}

function ReportCarteirasSection({ params }: { params: PeriodFilterState["params"] }) {
  const query = useQuery<WalletEvolution[]>({
    queryKey: ["report-wallets-evolution", params],
    queryFn: async () => {
      const { data } = await api.get<WalletEvolution[]>("/api/insights/wallets-evolution", { params });
      return data;
    },
  });

  const errorMessages = query.error
    ? getApiErrorMessages(query.error, "Não foi possível carregar as carteiras.")
    : [];
  const wallets = query.data ?? [];
  const chartData = wallets[0]?.points.map((_, index) => {
    const point: Record<string, string | number | null> = {
      label: formatMonthKey(monthKeyFromIso(wallets[0].points[index].date)),
    };
    wallets.forEach((wallet) => {
      point[wallet.nome] = wallet.points[index]?.balance ?? null;
    });
    return point;
  });

  return (
    <ReportSectionCard
      title="Carteiras"
      isLoading={query.isLoading}
      isError={query.isError}
      errorMessages={errorMessages}
      loadingLabel="Carregando carteiras..."
    >
      {wallets.length === 0 ? (
        <p className="text-sm text-text-secondary">Nenhuma carteira cadastrada.</p>
      ) : (
        chartData && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {wallets.map((wallet) => (
                <OverviewCard key={wallet.id} icon={Landmark} iconClassName="text-accent-lime" label={wallet.nome} value={formatCurrency(wallet.currentBalance)} />
              ))}
            </div>
            <WalletsChart wallets={wallets} data={chartData} />
          </>
        )
      )}
    </ReportSectionCard>
  );
}

function ReportAnnualSection({ year }: { year: number }) {
  const query = useQuery<InsightsAnnualAggregates>({
    queryKey: ["report-annual-aggregates", year],
    queryFn: async () => {
      const { data } = await api.get<InsightsAnnualAggregates>("/api/insights/annual-aggregates", { params: { year } });
      return data;
    },
  });

  const errorMessages = query.error
    ? getApiErrorMessages(query.error, "Não foi possível carregar a média anual.")
    : [];
  const result = query.data;

  return (
    <ReportSectionCard
      title="Média Anual"
      isLoading={query.isLoading}
      isError={query.isError}
      errorMessages={errorMessages}
      loadingLabel="Carregando média anual..."
    >
      {result && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <OverviewCard
              icon={ArrowLeftRight}
              iconClassName="text-accent-lime"
              label={`Renda média/mês (${result.year})`}
              value={formatCurrency(result.current.avgMonthlyIncome)}
              secondary={`${formatPct(result.yoyChange.incomePct)} vs ${result.previousYear}`}
            />
            <OverviewCard
              icon={ArrowLeftRight}
              iconClassName="text-accent-red"
              label={`Gasto médio/mês (${result.year})`}
              value={formatCurrency(result.current.avgMonthlyExpense)}
              secondary={`${formatPct(result.yoyChange.expensePct)} vs ${result.previousYear}`}
            />
            <OverviewCard
              icon={ArrowLeftRight}
              iconClassName="text-accent-lime"
              label="Saldo médio/mês"
              value={formatCurrency(result.current.avgMonthlyBalance)}
              secondary={`${formatPct(result.yoyChange.balancePct)} vs ${result.previousYear}`}
            />
          </div>

          {result.topCategories.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-text-secondary">Maiores categorias do ano</h4>
              {result.topCategories.map((category) => (
                <div key={category.categoryId ?? category.name} className="flex items-center justify-between text-sm">
                  <span>{category.name}</span>
                  <span className="text-text-secondary">
                    {formatCurrency(category.total)} · {category.percentOfExpenses.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </ReportSectionCard>
  );
}

function PersonalizedReportModal({
  filter,
  selected,
  onToggleSection,
  onClose,
  onGenerate,
}: {
  filter: PeriodFilterState;
  selected: Set<ReportSectionId>;
  onToggleSection: (id: ReportSectionId) => void;
  onClose: () => void;
  onGenerate: () => void;
}) {
  const canGenerate = selected.size > 0 && filter.enabled;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="fixed inset-0 cursor-default bg-black/60"
        onClick={onClose}
        aria-hidden="true"
        tabIndex={-1}
      />
      <div className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-bg-card p-6 shadow-xl">
        <h2 className="font-sans text-xl font-bold">Relatório Personalizado</h2>
        <p className="mt-1 text-sm text-text-secondary">Escolha o período e as seções que quer combinar no relatório.</p>

        <div className="mt-5">
          <PeriodFilterControls {...filter} />
          {filter.period === "custom" && !filter.enabled && (
            <p className="mt-2 text-sm text-text-secondary">Escolha as duas datas para gerar o relatório.</p>
          )}
        </div>

        <div className="mt-5 space-y-2">
          {REPORT_SECTIONS.map((section) => (
            <label
              key={section.id}
              className="flex cursor-pointer items-center gap-3 rounded-xl bg-bg-muted px-4 py-3 text-sm font-medium text-text-primary"
            >
              <input
                type="checkbox"
                checked={selected.has(section.id)}
                onChange={() => onToggleSection(section.id)}
                className="h-4 w-4 shrink-0 accent-accent-lime"
              />
              {section.label}
              {section.id === "contas" && <span className="ml-auto text-xs text-text-secondary">dados de hoje</span>}
            </label>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border-default px-4 py-2 text-sm font-medium text-text-secondary transition hover:text-text-primary"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canGenerate}
            onClick={onGenerate}
            className="rounded-xl bg-accent-lime px-4 py-2 text-sm font-bold text-black transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            Gerar
          </button>
        </div>
      </div>
    </div>
  );
}

function GeneratedReport({ config, onReset }: { config: GeneratedReportConfig; onReset: () => void }) {
  return (
    <div className="space-y-4 rounded-2xl border border-accent-lime/30 bg-bg-muted/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-sans text-xl font-bold">Relatório Personalizado</h2>
        <button
          type="button"
          onClick={onReset}
          className="text-sm font-medium text-text-secondary transition hover:text-text-primary"
        >
          Fechar relatório
        </button>
      </div>

      {config.sections.includes("cashflow") && <ReportCashflowSection params={config.params} />}
      {config.sections.includes("goals") && <ReportGoalsSection params={config.params} />}
      {config.sections.includes("gastos") && <ReportGastosSection params={config.params} />}
      {config.sections.includes("ganhos") && <ReportGanhosSection params={config.params} />}
      {config.sections.includes("contas") && <ReportContasSection />}
      {config.sections.includes("carteiras") && <ReportCarteirasSection params={config.params} />}
      {config.sections.includes("annual") && <ReportAnnualSection year={config.year} />}
    </div>
  );
}

function PersonalizedReportSection() {
  const filter = usePeriodFilter();
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Set<ReportSectionId>>(new Set());
  const [generatedConfig, setGeneratedConfig] = useState<GeneratedReportConfig | null>(null);

  const toggleSection = (id: ReportSectionId) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const reportYear =
    filter.period === "quarter"
      ? filter.quarterYear
      : filter.period === "custom"
        ? filter.customTo
          ? new Date(filter.customTo).getFullYear()
          : CURRENT_YEAR
        : filter.year;

  const handleGenerate = () => {
    setGeneratedConfig({ sections: Array.from(selected), params: filter.params, year: reportYear });
    setModalOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-xl border border-border-default px-4 py-2 text-sm font-semibold text-text-primary transition hover:border-accent-lime hover:text-accent-lime"
        >
          <FileText className="h-4 w-4" />
          Relatório Personalizado
        </button>
      </div>

      {modalOpen && (
        <PersonalizedReportModal
          filter={filter}
          selected={selected}
          onToggleSection={toggleSection}
          onClose={() => setModalOpen(false)}
          onGenerate={handleGenerate}
        />
      )}

      {generatedConfig && <GeneratedReport config={generatedConfig} onReset={() => setGeneratedConfig(null)} />}
    </div>
  );
}

// ─── Shell com abas ─────────────────────────────────────────────────────────

type InsightsTab = "overview" | "cashflow" | "goals" | "gastos" | "ganhos" | "contas" | "carteiras";

const TABS: { id: InsightsTab; label: string }[] = [
  { id: "overview", label: "Visão Geral" },
  { id: "cashflow", label: "Fluxo de Caixa" },
  { id: "goals", label: "Metas" },
  { id: "gastos", label: "Gastos" },
  { id: "ganhos", label: "Ganhos" },
  { id: "contas", label: "Contas" },
  { id: "carteiras", label: "Carteiras" },
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

      <div className="flex w-full gap-1 overflow-x-auto rounded-xl bg-bg-muted p-1 [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition",
              activeTab === tab.id ? "bg-accent-lime text-black" : "text-text-primary hover:bg-bg-overlay",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && <OverviewTab onNavigateTab={setActiveTab} />}
      {activeTab === "cashflow" && <CashflowTab />}
      {activeTab === "goals" && <GoalsTab />}
      {activeTab === "gastos" && <GastosTab />}
      {activeTab === "ganhos" && <GanhosTab />}
      {activeTab === "contas" && <ContasTab />}
      {activeTab === "carteiras" && <CarteirasTab />}
    </section>
  );
}
