export type ApiId = string;
export type ApiDate = string;

export type MongoDocument = {
  _id: ApiId;
  createdAt?: ApiDate;
  updatedAt?: ApiDate;
  __v?: number;
};

export type User = MongoDocument & {
  email: string;
  emailVerified: boolean;
  name?: string;
  avatarUrl?: string;
  gravatarUrl?: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type TransactionType = "EXPENSE" | "INCOME" | "TRANSFER";
export type TipoTransacao = "entrada" | "saida" | "transferencia";

export type Transaction = MongoDocument & {
  userId: ApiId;
  type: TransactionType;
  tipoTransacao?: TipoTransacao;
  value: number;
  categoryId?: ApiId;
  description?: string;
  date: ApiDate;
  carteiraId?: ApiId;
  carteiraDestinoId?: ApiId;
  agendado?: boolean;
  carteira?: VirtualWallet;
};

export type Wallet = MongoDocument & {
  userId: ApiId;
  nome: string;
  saldo: number;
  icone?: string;
  tipo?: "VIRTUAL";
};

/**
 * Carteira virtual injetada pelo backend quando uma transação/conta antiga não possui
 * carteiraId (dado anterior à feature de múltiplas carteiras). Não existe na coleção de
 * carteiras real — use sempre com optional chaining (`item.carteira?.nome`).
 */
export type VirtualWallet = {
  _id: "legacy-wallet";
  nome: string;
  tipo: "VIRTUAL";
};

export type TransactionsResponse = {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
};

export type Category = MongoDocument & {
  userId?: ApiId | null;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  isDefault: boolean;
};

export type PendingAccount = MongoDocument & {
  /**
   * Indica se a conta é parcelada.
   * @default false
   */
  /**
   * Indica se a conta é parcelada.
   * @default false
   */
  isParcelada?: boolean;

  /**
   * Indica se a conta é recorrente.
   * @default false
   */
  isRecorrente?: boolean;

  /**
   * Categoria da conta.
   * @default 'Outro'
   */
  categoria?: 'Alimentação' | 'Transporte' | 'Saúde' | 'Educação' | 'Lazer' | 'Outro';

  /**
   * Forma de pagamento.
   * @default 'Outro'
   */
  formatoPagamento?: 'Cartão de Crédito' | 'Pix' | 'Dinheiro' | 'Outro';

  /**
   * Indica se a conta é a pagar (despesa) ou a receber (receita).
   * @default 'PAGAR'
   */
  tipo?: 'PAGAR' | 'RECEBER';

  /**
   * Sub‑documento de parcelas – presente somente se isParcelada = true.
   */
  parcelas?: {
    totalParcelas: number;
    valorParcela: number;
    qtdParcelasPagas?: number;
    parcelasPagas?: number[];
    dataInicio: string; // ISO date
    dataFim: string;    // ISO date
  };
  numeroParcela?: number;
  grupoParceladoId?: string;

  /**
   * Sub‑documento de recorrência – presente somente se isRecorrente = true.
   */
  recorrencia?: {
    periodoRecorrencia: 'Diário' | 'Semanal' | 'Mensal' | 'Anual';
    dataProxima: string; // ISO date
  };

  userId: ApiId;
  title: string;
  value: number;
  dueDate: ApiDate;
  paid: boolean;
  paidAt?: ApiDate;
  description?: string;
  carteiraId?: ApiId;
  carteira?: VirtualWallet;
};

export type Goal = MongoDocument & {
  userId: ApiId;
  name: string;
  targetValue: number;
  currentValue: number;
  deadline?: ApiDate;
  completed: boolean;
  percentComplete?: number;
  linkedCategoryId?: ApiId | null;
};

export type DashboardExpenseByCategory = {
  categoryId: ApiId;
  categoryName: string;
  categoryColor?: string;
  categoryIcon?: string;
  total: number;
};

export type DashboardMonthlyEvolution = {
  month: number;
  income: number;
  expenses: number;
};

export type DashboardResponse = {
  month: number;
  year: number;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  savingsRate: number;
  expensesByCategory: DashboardExpenseByCategory[];
  monthlyEvolution: DashboardMonthlyEvolution[];
  pendingAccounts: {
    items: PendingAccount[];
    totalPending: number;
  };
  goalsSummary: Goal[];
};

export type InsightsPeriodTotals = {
  totalIncome: number;
  totalExpense: number;
  monthsWithData: number;
  avgMonthlyIncome: number;
  avgMonthlyExpense: number;
  avgMonthlyBalance: number;
};

export type InsightsTopCategory = {
  categoryId: string | null;
  name: string;
  total: number;
  percentOfExpenses: number;
  yoyPct: number | null;
};

export type InsightsAnnualSummary = {
  year: number;
  previousYear: number;
  current: InsightsPeriodTotals;
  previous: InsightsPeriodTotals;
  yoyChange: {
    incomePct: number | null;
    expensePct: number | null;
    balancePct: number | null;
  };
  topCategories: InsightsTopCategory[];
  narrative: string | null;
  narrativeUnavailable: boolean;
  noData: boolean;
};

export type InsightsAnnualAggregates = Omit<InsightsAnnualSummary, "narrative" | "narrativeUnavailable" | "noData">;

export type InsightsOverview = {
  topCategoryThisMonth: {
    categoryId: string | null;
    name: string;
    total: number;
    percentOfExpenses: number;
  } | null;
  monthComparison: {
    currentMonth: number;
    currentYear: number;
    previousMonth: number;
    previousYear: number;
    currentIncome: number;
    currentExpense: number;
    previousIncome: number;
    previousExpense: number;
    incomePct: number | null;
    expensePct: number | null;
    hasPreviousMonthData: boolean;
  };
  monthEndProjection: {
    daysElapsed: number;
    daysInMonth: number;
    actualIncome: number;
    actualExpense: number;
    projectedIncome: number;
    projectedExpense: number;
    projectedBalance: number;
  };
  healthScore: {
    score: number;
    label: "Excelente" | "Boa" | "Atenção" | "Crítica";
    breakdown: {
      savingsRateSub: number;
      overdueAccountsSub: number;
      spendingTrendSub: number;
    };
  };
};

export type CashflowPoint = {
  date: string;
  income: number;
  expense: number;
};

export type CashflowResult = {
  period: "month" | "quarter" | "year" | "custom";
  granularity: "day" | "week" | "month";
  from: string;
  to: string;
  points: CashflowPoint[];
  totals: { income: number; expense: number; balance: number };
};

export type GoalPace = {
  avgMonthlyContribution: number;
  monthsRemaining: number | null;
  requiredMonthlyContribution: number | null;
  onTrack: boolean | null;
};

export type GoalProgress = {
  id: string;
  name: string;
  targetValue: number;
  currentValue: number;
  percentComplete: number;
  deadline: string | null;
  completed: boolean;
  monthlyContributions: { month: string; amount: number }[];
  pace: GoalPace;
};

export type CategoryBreakdownItem = {
  categoryId: string | null;
  name: string;
  total: number;
};

export type ExpenseCategoryItem = CategoryBreakdownItem & { percentOfExpenses: number };
export type IncomeSourceItem = CategoryBreakdownItem & { percentOfIncome: number };

export type ExpensesBreakdownResult = {
  period: "month" | "quarter" | "year" | "custom";
  granularity: "day" | "week" | "month";
  from: string;
  to: string;
  byCategory: ExpenseCategoryItem[];
  evolutionSeries: string[];
  evolution: { date: string; values: Record<string, number> }[];
  topCategoryTrend: { name: string; currentMonthTotal: number; previousMonthTotal: number; momPct: number | null } | null;
};

export type IncomeConsistency = {
  monthsWithData: number;
  avgIncome: number;
  currentMonthTotal: number;
  variationPct: number | null;
};

export type IncomeBreakdownResult = {
  period: "month" | "quarter" | "year" | "custom";
  from: string;
  to: string;
  bySource: IncomeSourceItem[];
  monthlyConsistency: { month: string; total: number }[];
  consistency: IncomeConsistency | null;
};

export type AccountsOverview = {
  paidVsPending: { paidCount: number; paidValue: number; pendingCount: number; pendingValue: number };
  overdue: { count: number; value: number };
  dueThisWeek: { count: number; value: number };
  installmentsInProgress: {
    id: string;
    title: string;
    totalParcelas: number;
    paidParcelas: number;
    valorParcela: number;
    nextDueDate: string;
  }[];
  activeRecurringCount: number;
};

export type WalletEvolutionPoint = { date: string; balance: number };

export type WalletEvolution = {
  id: string;
  nome: string;
  currentBalance: number;
  points: WalletEvolutionPoint[];
};

export type Service = MongoDocument & {
  userId: ApiId;
  name: string;
  type?: string;
  defaultValue: number;
  active: boolean;
  categoryId: ApiId;
};

export type AppointmentStatus = "AGENDADO" | "EM_ANDAMENTO" | "FINALIZADO" | "CANCELADO";
export type AppointmentPaymentStatus = "NAO_PAGO" | "PARCIALMENTE_PAGO" | "PAGO";
export type AppointmentPaymentMethod = "PIX" | "DINHEIRO" | "CARTAO";

export type AppointmentPayment = {
  method: AppointmentPaymentMethod;
  value: number;
  paidAt: ApiDate;
  transactionId?: ApiId;
};

export type Appointment = MongoDocument & {
  userId: ApiId;
  serviceId: ApiId;
  clientName: string;
  clientPhone?: string;
  startAt: ApiDate;
  durationMinutes: number;
  endAt: ApiDate;
  chargedValue: number;
  status: AppointmentStatus;
  paymentStatus: AppointmentPaymentStatus;
  totalPaid: number;
  payments: AppointmentPayment[];
};

export type AvailabilityResponse = {
  date: string;
  slots: string[];
};

export type DailySummary = {
  date: string;
  totalReceived: number;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  servicesCompletedCount: number;
  avgTicket: number;
  paidCount: number;
  pendingCount: number;
};

export type ServiceReportRow = {
  serviceId: string;
  serviceName: string;
  count: number;
  revenue: number;
};

export type CategoryReportRow = {
  name: string;
  total: number;
  isIncome: boolean;
};

export type AgendaDashboard = {
  date: string;
  entradasHoje: number;
  saidasHoje: number;
  lucroLiquidoHoje: number;
  contasPendentes: { count: number; value: number };
  totalAgendamentosHoje: number;
  servicosConcluidosHoje: number;
  topServicesByCount: ServiceReportRow[];
  topServicesByRevenue: ServiceReportRow[];
  dailyRevenue: { date: string; revenue: number }[];
  categoryBreakdown: { income: CategoryReportRow[]; expense: CategoryReportRow[] };
};

export type ApiValidationError = {
  statusCode?: number;
  error?: string;
  message?: string | string[];
};
