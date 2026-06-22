import { useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Loader2, Plus, Trash2 } from "lucide-react";

import { api } from "../lib/api";

import { formatCurrency } from "../lib/finance";
import { cn } from "../lib/utils";
import { useToast } from "../components/ui/Toast";
import { ConfirmDeleteModal } from "../components/modals/ConfirmDeleteModal";
import type { PendingAccount } from "../types/api";

type PendingItem = {
  isParcelada?: boolean;
  isRecorrente?: boolean;
  categoria?: string;
  formatoPagamento?: string;
  parcelas?: { totalParcelas?: number; valorParcela?: number; parcelasPagas?: number[]; dataInicio?: string; dataFim?: string; };
  numeroParcela?: number;
  grupoParceladoId?: string;
  recorrencia?: { periodoRecorrencia?: string; dataProxima?: string; };
  id: string;
  title: string;
  value: number;
  dueDate: string;
  paid: boolean;
  description?: string;
};


const PENDING_CATEGORIES = ["Alimenta??o", "Transporte", "Sa?de", "Educa??o", "Lazer", "Outro"] as const;
const PAYMENT_FORMATS = ["Cart?o de Cr?dito", "Pix", "Dinheiro", "Outro"] as const;

type PendingCategory = (typeof PENDING_CATEGORIES)[number];
type PaymentFormat = (typeof PAYMENT_FORMATS)[number];

function isPendingCategory(value: string): value is PendingCategory {
  return (PENDING_CATEGORIES as readonly string[]).includes(value);
}

function isPaymentFormat(value: string): value is PaymentFormat {
  return (PAYMENT_FORMATS as readonly string[]).includes(value);
}

function toIsoDate(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function buildPendingPayload(data: {
  title: string;
  value: string;
  dueDate: string;
  description: string;
  isParcelada: boolean;
  isRecorrente: boolean;
  categoria: string;
  formatoPagamento: string;
  parcelas: { totalParcelas: string; dataInicio: string; dataFim: string };
  recorrencia: { periodoRecorrencia: string; dataProxima: string };
}) {
  const normalizedValue = Number(String(data.value).replace(/[^\d,-]/g, "").replace(",", "."));
  const totalParcelas = Number(data.parcelas.totalParcelas);
  const baseDate = data.parcelas.dataInicio || data.dueDate;

  return {
    title: data.title.trim(),
    value: Number.isFinite(normalizedValue) ? normalizedValue : undefined,
    dueDate: toIsoDate(data.dueDate),
    description: data.description.trim() || undefined,
    isParcelada: data.isParcelada,
    isRecorrente: data.isRecorrente,
    categoria: isPendingCategory(data.categoria) ? data.categoria : undefined,
    formatoPagamento: isPaymentFormat(data.formatoPagamento) ? data.formatoPagamento : undefined,
    parcelas: data.isParcelada && baseDate && Number.isFinite(totalParcelas) && totalParcelas > 0
      ? {
          totalParcelas,
          dataInicio: toIsoDate(data.parcelas.dataInicio ?? data.dueDate),
          dataFim: toIsoDate(data.parcelas.dataFim ?? data.dueDate),
          valorParcela: Number((normalizedValue / totalParcelas).toFixed(2)),
          parcelasPagas: 0,
        }
      : undefined,
    recorrencia: data.isRecorrente && data.recorrencia.periodoRecorrencia && data.recorrencia.dataProxima
      ? {
          periodoRecorrencia: data.recorrencia.periodoRecorrencia,
          dataProxima: toIsoDate(data.recorrencia.dataProxima),
        }
      : undefined,
  };
}

type PendingFormData = {
  title: string;
  value: string;
  dueDate: string;
  description: string;
  isParcelada: boolean;
  isRecorrente: boolean;
  categoria: string;
  formatoPagamento: string;
  parcelas: { totalParcelas: string; dataInicio: string; dataFim: string };
  recorrencia: { periodoRecorrencia: string; dataProxima: string };
};

function normalizePending(data: unknown): PendingItem[] {
  if (Array.isArray(data)) {
    return data.map((item) => ({
      id: item._id ?? item.id,
      title: item.title,
      value: item.value,
      dueDate: item.dueDate,
      paid: item.paid,
      description: item.description,
      parcelas: item.parcelas ? {
        totalParcelas: item.parcelas.totalParcelas,
        valorParcela: item.parcelas.valorParcela,
        parcelasPagas: item.parcelas.parcelasPagas,
        dataInicio: item.parcelas.dataInicio,
        dataFim: item.parcelas.dataFim,
      } : undefined,
      numeroParcela: item.numeroParcela,
      grupoParceladoId: item.grupoParceladoId,
    }));
  }

  if (
    data &&
    typeof data === "object" &&
    "items" in data &&
    Array.isArray((data as { items?: unknown }).items)
  ) {
    return normalizePending((data as { items: unknown[] }).items);
  }

  return [];
}

function statusLabel(item: PendingItem) {
  const dueDate = new Date(item.dueDate);
  const today = new Date();
  const sameDay = dueDate.toDateString() === today.toDateString();

  if (item.paid)
    return { label: "Pago", className: "bg-accent-lime/10 text-accent-lime" };
  if (dueDate < today)
    return { label: "Vencida", className: "bg-accent-red/10 text-accent-red" };
  if (sameDay)
    return {
      label: "Vence hoje",
      className: "bg-accent-yellow/10 text-accent-yellow",
    };

  return { label: "Pendente", className: "bg-bg-muted text-text-secondary" };
}

type PendingDisplayItem = PendingItem & {
  installmentLabel?: string;
};

type PendingMonthGroup = {
  key: string;
  label: string;
  items: PendingDisplayItem[];
};

function parseDate(value: string) {
  if (!value) return null;

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = isDateOnly ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMonths(date: Date, months: number) {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function sortMonthGroups(a: PendingMonthGroup, b: PendingMonthGroup) {
  return a.key.localeCompare(b.key);
}

const monthOptions = [
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

export function PendingPage() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [creating, setCreating] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [parcelStatusOpen, setParcelStatusOpen] = useState(false);
  const [selectedParcelItem, setSelectedParcelItem] = useState<PendingDisplayItem | null>(null);
  const [selectedDelete, setSelectedDelete] = useState<{ id: string; title: string } | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<PendingItem | null>(
    null,
  );
  const [editFormData, setEditFormData] = useState<PendingFormData>({
    title: "",
    value: "",
    dueDate: "",
    description: "",
    isParcelada: false,
    isRecorrente: false,
    categoria: "Outro",
    formatoPagamento: "Outro",
    parcelas: { totalParcelas: "", dataInicio: "", dataFim: "" },
    recorrencia: { periodoRecorrencia: "Mensal", dataProxima: "" },
  });

  // ? state dos campos do formulário
  const [formTitle, setFormTitle] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIsParcelada, setFormIsParcelada] = useState(false);
  const [formParcelas, setFormParcelas] = useState({ totalParcelas: "", dataInicio: "", dataFim: "" });
  const [formIsRecorrente, setFormIsRecorrente] = useState(false);
  const [formRecorrencia, setFormRecorrencia] = useState({ periodoRecorrencia: "Mensal", dataProxima: "" });
  const [formCategoria, setFormCategoria] = useState("");
  const [formFormatoPagamento, setFormFormatoPagamento] = useState("");
  const [categoriaCustom, setCategoriaCustom] = useState("");
  const [formaCustom, setFormaCustom] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!createError) return;
    const timer = window.setTimeout(() => setCreateError(null), 5000);
    return () => window.clearTimeout(timer);
  }, [createError]);

  const pendingQuery = useQuery<PendingItem[]>({
    queryKey: ["pending"],
    queryFn: async () => {
      const { data } = await api.get<PendingAccount[]>("/api/pending");
      return normalizePending(data);
    },
  });

  const items = pendingQuery.data ?? [];
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const years = useMemo(() => Array.from({ length: 30 }, (_, index) => currentYear + 10 - index), [currentYear]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const date = parseDate(item.dueDate);
      return !!date && date.getMonth() + 1 === selectedMonth && date.getFullYear() === selectedYear;
    });
  }, [items, selectedMonth, selectedYear]);

  const visibleItems = filteredItems;


  const displayGroups = useMemo(() => {
    const grouped = new Map<string, PendingMonthGroup>();

    for (const item of visibleItems) {
      const date = parseDate(item.dueDate);
      if (!date) continue;
      const key = monthKey(date);
      const current = grouped.get(key);
      if (current) current.items.push(item);
      else grouped.set(key, { key, label: monthLabel(date), items: [item] });
    }

    return Array.from(grouped.values()).sort(sortMonthGroups).map((group) => ({
      ...group,
      items: group.items.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    }));
  }, [visibleItems]);

  const totals = useMemo(() => {
    const pendingTotal = items
      .filter((item) => !item.paid)
      .reduce((sum, item) => sum + item.value, 0);
    const paidTotal = items
      .filter((item) => item.paid)
      .reduce((sum, item) => sum + item.value, 0);
    return { pendingTotal, paidTotal };
  }, [items]);

  const markPaid = useMutation({
    mutationFn: async ({ id, numeroParcela }: { id: string; numeroParcela?: number }) =>
      api.patch<PendingAccount>(`/api/pending/${id}`, { paid: true, numeroParcela }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pending"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      addToast("Conta marcada como paga com sucesso.", "success");
      setParcelStatusOpen(false);
      setSelectedParcelItem(null);
    },
    onError: () => addToast("Não foi possível atualizar a conta.", "error"),
  });

  const editPending = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        title?: string;
        value?: number;
        dueDate?: string;
        description?: string;
        paid?: boolean;
        isParcelada?: boolean;
        isRecorrente?: boolean;
        categoria?: string;
        formatoPagamento?: string;
        parcelas?: { totalParcelas?: number; dataInicio?: string; dataFim?: string };
        recorrencia?: { periodoRecorrencia?: string; dataProxima?: string };
      };
    }) => api.patch<PendingAccount>(`/api/pending/${id}`, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pending"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      addToast("Conta atualizada com sucesso.", "success");
      fecharModal();
    },
    onError: () => addToast("Não foi possível editar a conta.", "error"),
  });

  const deletePending = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/pending/${id}`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pending"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      addToast("Conta apagada com sucesso.", "success");
    },
    onError: () => addToast("Não foi possível apagar a conta.", "error"),
  });

  function abrirModalEdicao(item: PendingItem) {
    setSelectedAccount(item);
    setEditFormData({
      title: item.title,
      value: String(item.value),
      dueDate: item.dueDate.slice(0, 10),
      description: item.description ?? "",
      isParcelada: !!item.isParcelada,
      isRecorrente: !!item.isRecorrente,
      categoria: item.categoria ?? "Outro",
      formatoPagamento: item.formatoPagamento ?? "Outro",
      parcelas: {
        totalParcelas: item.parcelas?.totalParcelas?.toString() ?? "",
        dataInicio: item.parcelas?.dataInicio?.slice(0, 10) ?? "",
        dataFim: item.parcelas?.dataFim?.slice(0, 10) ?? "",
      },
      recorrencia: {
        periodoRecorrencia: item.recorrencia?.periodoRecorrencia ?? "Mensal",
        dataProxima: item.recorrencia?.dataProxima?.slice(0, 10) ?? "",
      },
    });
    setIsEditModalOpen(true);
  }

  function fecharModal() {
    setIsEditModalOpen(false);
    setSelectedAccount(null);
    setEditFormData({
      title: "",
      value: "",
      dueDate: "",
      description: "",
      isParcelada: false,
      isRecorrente: false,
      categoria: "Outro",
      formatoPagamento: "Outro",
      parcelas: { totalParcelas: "", dataInicio: "", dataFim: "" },
      recorrencia: { periodoRecorrencia: "Mensal", dataProxima: "" },
    });
  }

  function salvarEdicao() {
    if (!selectedAccount) return;

    editPending.mutate({
      id: selectedAccount.id,
      payload: {
        title: editFormData.title.trim(),
        value: parseFloat(editFormData.value),
        dueDate: toIsoDate(editFormData.dueDate),
        description: editFormData.description.trim() || undefined,
        isParcelada: editFormData.isParcelada,
        isRecorrente: editFormData.isRecorrente,
        categoria: isPendingCategory(editFormData.categoria) ? editFormData.categoria : undefined,
        formatoPagamento: isPaymentFormat(editFormData.formatoPagamento) ? editFormData.formatoPagamento : undefined,
        parcelas: editFormData.isParcelada
          ? {
              totalParcelas: Number(editFormData.parcelas.totalParcelas),
              dataInicio: toIsoDate(editFormData.parcelas.dataInicio),
              dataFim: toIsoDate(editFormData.parcelas.dataFim),
            }
          : undefined,
        recorrencia: editFormData.isRecorrente
          ? {
              periodoRecorrencia: editFormData.recorrencia.periodoRecorrencia,
              dataProxima: toIsoDate(editFormData.recorrencia.dataProxima),
            }
          : undefined,
      },
    });
  }

  function abrirParcelStatus(item: PendingDisplayItem) {
    setSelectedParcelItem(item);
    setParcelStatusOpen(true);
  }

  function confirmarDeletar(id: string, title: string) {
    setSelectedDelete({ id, title });
    setDeleteModalOpen(true);
  }

  // ? mutation para criar conta pendente
  const createPending = useMutation({
    mutationFn: async () => {
      setCreateError(null);
      const payload = buildPendingPayload({
        title: formTitle,
        value: formValue,
        dueDate: formIsParcelada ? (formParcelas.dataInicio || formDueDate) : formDueDate,
        description: formDescription,
        isParcelada: formIsParcelada,
        isRecorrente: formIsRecorrente,
        categoria: formCategoria && formCategoria !== "Outro" ? formCategoria : categoriaCustom,
        formatoPagamento: formFormatoPagamento && formFormatoPagamento !== "Outro" ? formFormatoPagamento : formaCustom,
        parcelas: formParcelas,
        recorrencia: formRecorrencia,
      });

      console.log("[PendingPage] create payload", payload);
      try {
        const response = await api.post("/api/pending", payload);
        console.log("[PendingPage] create response", response.data);
      } catch (error) {
        console.error("[PendingPage] create error", error);
        throw error;
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pending"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      addToast("Conta adicionada com sucesso.", "success");
      setCreating(false);
      setFormTitle("");
      setFormValue("");
      setFormDueDate("");
      setFormDescription("");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Não foi possível salvar a conta.";
      setCreateError(message);
      addToast(message, "error");
    },
  });

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-text-secondary">Itens em aberto</p>
          <h1 className="text-3xl font-bold">Contas Pendentes</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-xl bg-accent-lime px-4 py-3 text-sm font-bold text-black"
          >
            <Plus className="h-4 w-4" />
            Nova
          </button>
          <select
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(Number(event.target.value))}
            className="rounded-xl border border-bg-muted bg-bg-card px-4 py-3 text-sm text-white outline-none transition focus:border-accent-lime"
          >
            {monthOptions.map((label, index) => (
              <option key={label} value={index + 1}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(event) => setSelectedYear(Number(event.target.value))}
            className="rounded-xl border border-bg-muted bg-bg-card px-4 py-3 text-sm text-white outline-none transition focus:border-accent-lime"
          >
            {years.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-accent-red/20 bg-bg-card p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
            Total em aberto
          </p>
          <p className="mt-3 text-3xl font-bold text-accent-red">
            {formatCurrency(totals.pendingTotal)}
          </p>
        </article>
        <article className="rounded-2xl border border-accent-lime/20 bg-bg-card p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-text-muted">
            Total pago no mês
          </p>
          <p className="mt-3 text-3xl font-bold text-accent-lime">
            {formatCurrency(totals.paidTotal)}
          </p>
        </article>
      </div>

      {createError && (
        <div className="rounded-2xl border border-accent-red/30 bg-accent-red/10 p-4 text-sm text-accent-red flex items-start justify-between gap-3">
          <p>{createError}</p>
          <button
            type="button"
            onClick={() => setCreateError(null)}
            className="shrink-0 rounded-lg border border-accent-red/30 px-2 py-1 text-xs font-semibold text-accent-red transition hover:bg-accent-red/10"
          >
            Fechar
          </button>
        </div>
      )}

      {pendingQuery.isLoading ? (
        <div className="rounded-2xl bg-bg-card p-5 text-sm text-text-secondary">
          Carregando contas...
        </div>
      ) : (
        <div className="space-y-6">
          {displayGroups.map((group) => (
            <section key={group.key} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">{group.label}</h2>
                <span className="text-sm text-text-secondary">{group.items.length} item(ns)</span>
              </div>
              <div className="space-y-3">
                {group.items.map((item) => {
                  const status = statusLabel(item);
                  const dueDate = new Date(item.dueDate);
                  const installmentLabel = item.installmentLabel ?? (item.numeroParcela && item.parcelas?.totalParcelas ? `parcela ${item.numeroParcela}/${item.parcelas.totalParcelas}` : undefined);

                  return (
                    <article
                      key={`${item.id}-${item.dueDate}`}
                      className={cn(
                        "rounded-2xl border bg-bg-card p-4 transition",
                        item.paid && "opacity-60",
                        dueDate < new Date() && !item.paid ? "border-accent-red/50" : "border-bg-muted",
                        dueDate.toDateString() === new Date().toDateString() && !item.paid ? "border-accent-yellow/50" : "",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-2xl bg-bg-muted p-3">
                          <Clock className="h-5 w-5 text-accent-lime" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-semibold text-white">{item.title}</h2>
                            {installmentLabel && (
                              <span className="rounded-full bg-accent-lime/10 px-2.5 py-1 text-[11px] font-semibold text-accent-lime">{installmentLabel}</span>
                            )}
                            <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", status.className)}>{status.label}</span>
                          </div>
                          <p className="mt-1 text-sm text-text-secondary">{item.description ?? "Conta pendente"}</p>
                          <p className="mt-2 text-xs text-text-muted">Vence em {dueDate.toLocaleDateString("pt-BR")}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-white">{formatCurrency(item.value)}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {!item.paid && (
                          <button
                            type="button"
                            onClick={() => markPaid.mutate({ id: item.id, numeroParcela: item.numeroParcela })}
                            disabled={markPaid.isPending}
                            className="inline-flex items-center gap-2 rounded-xl bg-accent-lime/10 px-3 py-2 text-sm font-semibold text-accent-lime hover:bg-accent-lime/20 disabled:opacity-60"
                          >
                            {markPaid.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            Marcar como pago
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => abrirParcelStatus(item)}
                          className="rounded-xl bg-bg-muted px-3 py-2 text-sm text-white"
                        >
                          Parcelas
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirModalEdicao(item)}
                          className="rounded-xl bg-bg-muted px-3 py-2 text-sm text-white"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmarDeletar(item.id, item.title)}
                          disabled={deletePending.isPending}
                          className="rounded-xl bg-bg-muted px-3 py-2 text-sm text-accent-red"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-md max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-bg-muted bg-bg-card">
            <h2 className="text-lg font-bold text-white">
              Nova conta pendente
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Cadastre uma conta para acompanhar o pagamento.
            </p>
            <div className="mt-4 flex-1 overflow-y-auto px-5 pb-3 space-y-3">
              {/* ? inputs controlados com state */}
                {/* Segmented control for account type */}
                <div className="flex space-x-1 rounded-xl bg-bg-muted p-1 mb-4">
                  {['Não parcelada', 'Parcelada', 'Recorrente'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`flex-1 rounded px-3 py-2 text-sm font-medium ${
                        (formIsParcelada && type === 'Parcelada') ||
                        (formIsRecorrente && type === 'Recorrente') ||
                        (!formIsParcelada && !formIsRecorrente && type === 'Não parcelada')
                          ? 'bg-accent-lime text-black'
                          : 'text-white'
                      }`}
                      onClick={() => {
                        setFormIsParcelada(type === 'Parcelada');
                        setFormIsRecorrente(type === 'Recorrente');
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
                {/* Conditional fields */}
                {formIsParcelada && (
                  <div className="space-y-2 mb-4">
                    <label className="block text-sm text-white">Valor total</label>
                    <input
                      type="number"
                      placeholder="Valor total"
                      className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
                      value={formValue}
                      onChange={(e) => setFormValue(e.target.value)}
                    />
                    <label className="block text-sm text-white">Quantidade de parcelas</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      placeholder="ex:2"
                      className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
                      value={formParcelas.totalParcelas}
                      onChange={(e) => setFormParcelas((prev) => ({ ...prev, totalParcelas: e.target.value }))}
                    />
                    {/* Valor da parcela (readonly) */}
                    {formParcelas.totalParcelas && formValue && (
                      <p className="text-sm text-text-secondary">
                        Valor da parcela: {(parseFloat(formValue) / Number(formParcelas.totalParcelas)).toFixed(2)}
                      </p>
                    )}
                    <label className="block text-sm text-white">Data de início</label>
                    <input
                      type="date"
                      className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
                      value={formParcelas.dataInicio}
                      onChange={(e) => setFormParcelas((prev) => ({ ...prev, dataInicio: e.target.value }))}
                    />
                    <label className="block text-sm text-white">Data de fim</label>
                    <input
                      type="date"
                      className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
                      value={formParcelas.dataFim}
                      onChange={(e) => setFormParcelas((prev) => ({ ...prev, dataFim: e.target.value }))}
                    />
                  </div>
                )}
                {formIsRecorrente && (
                  <div className="space-y-2 mb-4">
                    <label className="block text-sm text-white">Período de recorrência</label>
                    <select
                      value={formRecorrencia.periodoRecorrencia}
                      onChange={(e) => setFormRecorrencia(prev => ({ ...prev, periodoRecorrencia: e.target.value }))}
                      className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
                    >
                      <option value="Diário">Diário</option>
                      <option value="Semanal">Semanal</option>
                      <option value="Mensal">Mensal</option>
                      <option value="Anual">Anual</option>
                    </select>
                    <label className="block text-sm text-white">Próxima data</label>
                    <input
                      type="date"
                      className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
                      value={formRecorrencia.dataProxima}
                      onChange={(e) => setFormRecorrencia(prev => ({ ...prev, dataProxima: e.target.value }))}
                    />
                  </div>
                )}
                {/* Categoria with label and optional custom field */}
                <label className="block text-sm text-white mt-2">Categoria</label>
                <select
                  value={formCategoria}
                  onChange={(e) => {
                    setFormCategoria(e.target.value);
                    if (e.target.value !== 'Outro') setCategoriaCustom('');
                  }}
                  className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
                >
                  <option value="">Selecione</option>
                  {PENDING_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                {formCategoria === 'Outro' && (
                  <input
                    type="text"
                    placeholder="Digite a categoria personalizada"
                    className="mt-1 w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
                    value={categoriaCustom}
                    onChange={(e) => setCategoriaCustom(e.target.value)}
                  />
                )}
                {/* Forma de pagamento with label and optional custom field */}
                <label className="block text-sm text-white mt-2">Forma de pagamento</label>
                <select
                  value={formFormatoPagamento}
                  onChange={(e) => {
                    setFormFormatoPagamento(e.target.value);
                    if (e.target.value !== 'Outro') setFormaCustom('');
                  }}
                  className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
                >
                  <option value="">Selecione</option>
                  {PAYMENT_FORMATS.map((format) => (
                    <option key={format} value={format}>
                      {format}
                    </option>
                  ))}
                </select>
                {formFormatoPagamento === 'Outro' && (
                  <input
                    type="text"
                    placeholder="Digite a forma de pagamento personalizada"
                    className="mt-1 w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
                    value={formaCustom}
                    onChange={(e) => setFormaCustom(e.target.value)}
                  />
                )}
              <input
                className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
                placeholder="Título"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
              <input
                type="number"
                className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
                placeholder="Valor"
                value={formValue}
                onChange={(e) => setFormValue(e.target.value)}
              />
              {!formIsParcelada && (
                <input
                  type="date"
                  className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                />
              )}
              <textarea
                rows={3}
                className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
                placeholder="Descrição (opcional)"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-bg-muted px-5 py-3">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="rounded-xl border border-bg-muted px-4 py-2 text-sm text-white"
              >
                Cancelar
              </button>
              {/* ? onClick chama a mutation */}
              <button
                type="button"
                onClick={() => createPending.mutate()}
                disabled={createPending.isPending}
                className="flex items-center gap-2 rounded-xl bg-accent-lime px-4 py-2 text-sm font-bold text-black disabled:opacity-70"
              >
                {createPending.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-md max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-bg-muted bg-bg-card">
            <h2 className="text-lg font-bold text-white">
              Editar conta pendente
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Atualize os dados da conta selecionada.
            </p>
            <div className="mt-4 flex-1 overflow-y-auto px-5 pb-3 space-y-3">
              <input
                className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
                placeholder="Título"
                value={editFormData.title}
                onChange={(e) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
              />
              <input
                type="number"
                className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
                placeholder="Valor"
                value={editFormData.value}
                onChange={(e) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    value: e.target.value,
                  }))
                }
              />
              <input
                type="date"
                className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
                value={editFormData.dueDate}
                onChange={(e) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    dueDate: e.target.value,
                  }))
                }
              />
              <textarea
                rows={3}
                className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
                placeholder="Descrição (opcional)"
                value={editFormData.description}
                onChange={(e) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-bg-muted px-5 py-3">
              <button
                type="button"
                onClick={fecharModal}
                className="rounded-xl border border-bg-muted px-4 py-2 text-sm text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarEdicao}
                disabled={editPending.isPending}
                className="flex items-center gap-2 rounded-xl bg-accent-lime px-4 py-2 text-sm font-bold text-black disabled:opacity-70"
              >
                {editPending.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
      {parcelStatusOpen && selectedParcelItem && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-bg-muted bg-bg-card p-5">
            <h2 className="text-lg font-bold text-white">Status das parcelas</h2>
            <p className="mt-1 text-sm text-text-secondary">{selectedParcelItem.title}</p>
            <div className="mt-4 space-y-2 text-sm text-white">
              <p>Parcela: {selectedParcelItem.installmentLabel ?? (selectedParcelItem.numeroParcela && selectedParcelItem.parcelas?.totalParcelas ? `parcela ${selectedParcelItem.numeroParcela}/${selectedParcelItem.parcelas.totalParcelas}` : "")}</p>
              <p>Valor: {formatCurrency(selectedParcelItem.value)}</p>
              <p>Vencimento: {new Date(selectedParcelItem.dueDate).toLocaleDateString("pt-BR")}</p>
              <p>Status atual: {(selectedParcelItem.parcelas?.parcelasPagas?.length ?? (selectedParcelItem.paid ? 1 : 0))}/{selectedParcelItem.parcelas?.totalParcelas ?? 0} pagas</p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setParcelStatusOpen(false)} className="rounded-xl border border-bg-muted px-4 py-2 text-sm text-white">Fechar</button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDeleteModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={() => {
          if (selectedDelete) {
            deletePending.mutate(selectedDelete.id);
          }
          setDeleteModalOpen(false);
        }}
        accountName={selectedDelete?.title ?? ""}
      />
      </section>
  );
}
















































