import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Loader2, Plus, Trash2 } from "lucide-react";

import { api } from "../lib/api";

import { formatCurrency } from "../lib/finance";
import { cn } from "../lib/utils";
import { useToast } from "../components/ui/Toast";
import { ConfirmDeleteModal } from "../components/modals/ConfirmDeleteModal";
import { DynamicIcon } from "../components/DynamicIcon";
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
  recorrenciaTemplateId?: string;
  isVirtual?: boolean;
  templateId?: string;
  id: string;
  title: string;
  value: number;
  dueDate: string;
  paid: boolean;
  description?: string;
};


const PENDING_CATEGORIES = ["Alimentação", "Transporte", "Saúde", "Educação", "Lazer", "Outro"] as const;
const PAYMENT_FORMATS = ["Cartão de Crédito", "Pix", "Dinheiro", "Outro"] as const;

const CATEGORY_META: Record<string, { icon: string; color: string }> = {
  "Alimentação": { icon: "Utensils",      color: "#f97316" },
  "Transporte":  { icon: "Car",           color: "#3b82f6" },
  "Saúde":       { icon: "Heart",         color: "#ef4444" },
  "Educação":    { icon: "BookOpen",      color: "#8b5cf6" },
  "Lazer":       { icon: "Smile",         color: "#22c55e" },
  "Outro":       { icon: "MoreHorizontal",color: "#6b7280" },
};

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
  const normalizedValue = parseFloat(String(data.value).replace(",", "."));
  const totalParcelas = Number(data.parcelas.totalParcelas);
  const baseDate = data.parcelas.dataInicio || data.dueDate;

  return {
    title: data.title.trim(),
    value: Number.isFinite(normalizedValue) ? normalizedValue : undefined,
    dueDate: toIsoDate(data.dueDate),
    description: data.description.trim() || undefined,
    isParcelada: data.isParcelada,
    isRecorrente: data.isRecorrente,
    categoria: data.categoria?.trim() || undefined,
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
    recorrencia: data.isRecorrente && data.recorrencia.periodoRecorrencia
      ? {
          periodoRecorrencia: data.recorrencia.periodoRecorrencia,
          dataProxima: toIsoDate(data.dueDate),
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
      id: item.isVirtual ? (item.templateId ?? item._id ?? item.id) : (item._id ?? item.id),
      title: item.title,
      value: item.value,
      dueDate: item.dueDate,
      paid: item.paid,
      description: item.description,
      isParcelada: item.isParcelada,
      isRecorrente: item.isRecorrente,
      categoria: item.categoria,
      formatoPagamento: item.formatoPagamento,
      parcelas: item.parcelas ? {
        totalParcelas: item.parcelas.totalParcelas,
        valorParcela: item.parcelas.valorParcela,
        parcelasPagas: item.parcelas.parcelasPagas,
        dataInicio: item.parcelas.dataInicio,
        dataFim: item.parcelas.dataFim,
      } : undefined,
      numeroParcela: item.numeroParcela,
      grupoParceladoId: item.grupoParceladoId,
      recorrencia: item.recorrencia ? {
        periodoRecorrencia: item.recorrencia.periodoRecorrencia,
        dataProxima: item.recorrencia.dataProxima,
      } : undefined,
      recorrenciaTemplateId: item.recorrenciaTemplateId,
      isVirtual: item.isVirtual,
      templateId: item.templateId,
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
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("action") === "create") {
      setCreating(true);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("action");
        return next;
      }, { replace: true });
    }
  }, []);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [parcelStatusOpen, setParcelStatusOpen] = useState(false);
  const [selectedParcelItem, setSelectedParcelItem] = useState<PendingDisplayItem | null>(null);
  const [selectedDelete, setSelectedDelete] = useState<{
    id: string;
    title: string;
    isParcel?: boolean;
    parcelLabel?: string;
    grupoParceladoId?: string;
    isVirtual?: boolean;
    isRecorrente?: boolean;
    templateId?: string;
    month?: number;
    year?: number;
  } | null>(null);
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
  const [categoriaCustom, setCategoriaCustom] = useState("");
  const [formFormatoPagamento, setFormFormatoPagamento] = useState("");
  const [formaCustom, setFormaCustom] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!createError) return;
    const timer = window.setTimeout(() => setCreateError(null), 5000);
    return () => window.clearTimeout(timer);
  }, [createError]);

  useEffect(() => {
    const total = Number(formParcelas.totalParcelas);
    if (!formParcelas.dataInicio || !total || total <= 0) return;
    const start = new Date(`${formParcelas.dataInicio}T12:00:00`);
    if (Number.isNaN(start.getTime())) return;
    const end = new Date(start);
    end.setMonth(end.getMonth() + total - 1);
    setFormParcelas((prev) => ({ ...prev, dataFim: end.toISOString().slice(0, 10) }));
  }, [formParcelas.dataInicio, formParcelas.totalParcelas]);

  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 11 }, (_, i) => now + 5 - i);
  }, []);

  const groupQuery = useQuery<PendingItem[]>({
    queryKey: ["pending-group", selectedParcelItem?.grupoParceladoId],
    queryFn: async () => {
      const { data } = await api.get<unknown[]>(`/api/pending/group/${selectedParcelItem!.grupoParceladoId}`);
      return normalizePending(data);
    },
    enabled: parcelStatusOpen && !!selectedParcelItem?.grupoParceladoId,
  });

  const pendingQuery = useQuery<PendingItem[]>({
    queryKey: ["pending", selectedMonth, selectedYear],
    queryFn: async () => {
      const { data } = await api.get<PendingAccount[]>(
        `/api/pending?month=${selectedMonth}&year=${selectedYear}`,
      );
      return normalizePending(data);
    },
  });

  const items = pendingQuery.data ?? [];
  const visibleItems = items;


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
    mutationFn: async ({
      id,
      isVirtual,
      numeroParcela,
      month,
      year,
    }: {
      id: string;
      isVirtual?: boolean;
      numeroParcela?: number;
      month: number;
      year: number;
    }) => {
      if (isVirtual) {
        return api.post(`/api/pending/${id}/pay-month`, { month, year });
      }
      return api.patch<PendingAccount>(`/api/pending/${id}`, { paid: true, numeroParcela });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-expenses"] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      addToast("Conta atualizada com sucesso.", "success");
      fecharModal();
    },
    onError: () => addToast("Não foi possível editar a conta.", "error"),
  });

  const deletePending = useMutation({
    mutationFn: async (id: string) => api.delete(`/api/pending/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      addToast("Conta apagada com sucesso.", "success");
    },
    onError: () => addToast("Não foi possível apagar a conta.", "error"),
  });

  const deleteRecurringMonth = useMutation({
    mutationFn: async ({ templateId, month, year }: { templateId: string; month: number; year: number }) =>
      api.delete(`/api/pending/${templateId}/month`, { params: { month, year } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      addToast("Mês excluído com sucesso.", "success");
    },
    onError: () => addToast("Não foi possível excluir.", "error"),
  });

  const deleteGroupPending = useMutation({
    mutationFn: async (grupoParceladoId: string) => api.delete(`/api/pending/group/${grupoParceladoId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
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

  function confirmarDeletar(item: PendingItem) {
    const isParcel = !!item.grupoParceladoId && !!item.numeroParcela;
    const isRecorrente = !!(item.isRecorrente || item.isVirtual || item.recorrenciaTemplateId);
    const templateId = item.templateId ?? item.recorrenciaTemplateId ?? (item.isRecorrente ? item.id : undefined);
    setSelectedDelete({
      id: isRecorrente ? (templateId ?? item.id) : item.id,
      title: item.title,
      isParcel: isRecorrente ? false : isParcel,
      parcelLabel: isParcel && item.numeroParcela && item.parcelas?.totalParcelas ? `Parcela ${item.numeroParcela}/${item.parcelas.totalParcelas}` : undefined,
      grupoParceladoId: item.grupoParceladoId,
      isVirtual: item.isVirtual,
      isRecorrente,
      templateId,
      month: selectedMonth,
      year: selectedYear,
    });
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
        categoria: formCategoria === "Outro" && categoriaCustom.trim() ? categoriaCustom.trim() : formCategoria,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      addToast("Conta adicionada com sucesso.", "success");
      setCreating(false);
      setFormTitle("");
      setFormValue("");
      setFormDueDate("");
      setFormDescription("");
      setFormIsParcelada(false);
      setFormIsRecorrente(false);
      setFormParcelas({ totalParcelas: "", dataInicio: "", dataFim: "" });
      setFormRecorrencia({ periodoRecorrencia: "Mensal", dataProxima: "" });
      setFormCategoria("");
      setCategoriaCustom("");
      setFormFormatoPagamento("");
      setFormaCustom("");
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
                            {(item.isRecorrente || item.isVirtual || item.recorrenciaTemplateId) && (
                              <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold text-blue-400">Recorrente</span>
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
                            onClick={() => markPaid.mutate({
                              id: item.id,
                              isVirtual: item.isVirtual,
                              numeroParcela: item.numeroParcela,
                              month: selectedMonth,
                              year: selectedYear,
                            })}
                            disabled={markPaid.isPending}
                            className="inline-flex items-center gap-2 rounded-xl bg-accent-lime/10 px-3 py-2 text-sm font-semibold text-accent-lime hover:bg-accent-lime/20 disabled:opacity-60"
                          >
                            {markPaid.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            Marcar como pago
                          </button>
                        )}
                        {item.isParcelada && (
                          <button
                            type="button"
                            onClick={() => abrirParcelStatus(item)}
                            className="rounded-xl bg-bg-muted px-3 py-2 text-sm text-white"
                          >
                            Parcelas
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => abrirModalEdicao(item)}
                          className="rounded-xl bg-bg-muted px-3 py-2 text-sm text-white"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmarDeletar(item)}
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
            <div className="px-5 pt-5 pb-1">
              <h2 className="text-lg font-bold text-white">Nova conta pendente</h2>
              <p className="mt-1 text-sm text-text-secondary">Cadastre uma conta para acompanhar o pagamento.</p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-4 mt-4">
              {/* Tipo de conta */}
              <div className="flex space-x-1 rounded-xl bg-bg-muted p-1">
                {['Não parcelada', 'Parcelada', 'Recorrente'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`flex-1 rounded px-2 py-2 text-xs font-medium transition sm:px-3 sm:text-sm ${
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

              {/* Valor */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">Valor</label>
                <div className="flex items-center gap-3 rounded-xl border border-bg-muted bg-bg-muted px-4 py-3">
                  <span className="shrink-0 text-sm font-medium text-text-secondary">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    className="flex-1 bg-transparent text-center text-xl font-bold text-accent-lime outline-none [appearance:textfield] placeholder:text-text-muted [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                  />
                </div>
              </div>

              {/* Campos parcelada */}
              {formIsParcelada && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">Quantidade de parcelas</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      placeholder="ex: 10"
                      className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-lime/50"
                      value={formParcelas.totalParcelas}
                      onChange={(e) => setFormParcelas((prev) => ({ ...prev, totalParcelas: e.target.value }))}
                    />
                    {formParcelas.totalParcelas && formValue && (
                      <p className="mt-1.5 text-xs text-text-muted">
                        Valor por parcela:{" "}
                        <span className="font-semibold text-accent-lime">
                          {formatCurrency(parseFloat(formValue) / Number(formParcelas.totalParcelas))}
                        </span>
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">Data de início</label>
                    <input
                      type="date"
                      className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-lime/50"
                      value={formParcelas.dataInicio}
                      onChange={(e) => setFormParcelas((prev) => ({ ...prev, dataInicio: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-2">Data de fim</label>
                    <input
                      type="date"
                      readOnly
                      className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-text-secondary cursor-default"
                      value={formParcelas.dataFim}
                    />
                  </div>
                </div>
              )}

              {/* Campos recorrente */}
              {formIsRecorrente && (
                <div>
                  <label className="block text-sm text-text-secondary mb-2">Período de recorrência</label>
                  <select
                    value={formRecorrencia.periodoRecorrencia}
                    onChange={(e) => setFormRecorrencia((prev) => ({ ...prev, periodoRecorrencia: e.target.value }))}
                    className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-lime/50"
                  >
                    <option value="Diário">Diário</option>
                    <option value="Semanal">Semanal</option>
                    <option value="Mensal">Mensal</option>
                    <option value="Anual">Anual</option>
                  </select>
                </div>
              )}

              {/* Título */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">Título</label>
                <input
                  className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-lime/50"
                  placeholder="Ex: Conta de luz"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>

              {/* Data (não parcelada) */}
              {!formIsParcelada && (
                <div>
                  <label className="block text-sm text-text-secondary mb-2">Data de vencimento</label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-lime/50"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                  />
                </div>
              )}

              {/* Categoria */}
              <div>
                <span className="mb-2 block text-sm text-text-secondary">Categoria</span>
                <div className="grid grid-cols-3 gap-2">
                  {PENDING_CATEGORIES.map((cat) => {
                    const meta = CATEGORY_META[cat];
                    const active = formCategoria === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setFormCategoria(active ? "" : cat);
                          if (active || cat !== "Outro") setCategoriaCustom("");
                        }}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1.5 rounded-xl border bg-bg-muted p-3 text-center text-xs font-semibold transition",
                          active
                            ? "border-accent-lime text-white"
                            : "border-transparent text-text-secondary hover:border-bg-overlay hover:text-white",
                        )}
                      >
                        <span
                          className="grid h-8 w-8 place-items-center rounded-xl"
                          style={{ backgroundColor: `${meta.color}22` }}
                        >
                          <DynamicIcon name={meta.icon} className="h-4 w-4" style={{ color: meta.color }} />
                        </span>
                        <span className="leading-tight">{cat}</span>
                      </button>
                    );
                  })}
                </div>
                {formCategoria === "Outro" && (
                  <input
                    type="text"
                    placeholder="Qual categoria?"
                    maxLength={50}
                    className="mt-2 w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-lime/50"
                    value={categoriaCustom}
                    onChange={(e) => setCategoriaCustom(e.target.value)}
                  />
                )}
              </div>

              {/* Forma de pagamento */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">Forma de pagamento</label>
                <select
                  value={formFormatoPagamento}
                  onChange={(e) => {
                    setFormFormatoPagamento(e.target.value);
                    if (e.target.value !== 'Outro') setFormaCustom('');
                  }}
                  className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-lime/50"
                >
                  <option value="">Selecione</option>
                  {PAYMENT_FORMATS.map((format) => (
                    <option key={format} value={format}>{format}</option>
                  ))}
                </select>
                {formFormatoPagamento === 'Outro' && (
                  <input
                    type="text"
                    placeholder="Digite a forma de pagamento personalizada"
                    className="mt-2 w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-lime/50"
                    value={formaCustom}
                    onChange={(e) => setFormaCustom(e.target.value)}
                  />
                )}
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">Descrição <span className="text-text-muted">(opcional)</span></label>
                <textarea
                  rows={3}
                  className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-lime/50 resize-none"
                  placeholder="Adicione uma observação..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
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
      {parcelStatusOpen && selectedParcelItem && (() => {
        const liveItem = items.find((i) => i.id === selectedParcelItem.id) ?? selectedParcelItem;
        const grupoItems = groupQuery.data && groupQuery.data.length > 0
          ? groupQuery.data
          : (liveItem.grupoParceladoId
              ? items.filter((i) => i.grupoParceladoId === liveItem.grupoParceladoId)
              : [liveItem]
            ).sort((a, b) => (a.numeroParcela ?? 0) - (b.numeroParcela ?? 0));
        const totalParcelas = liveItem.parcelas?.totalParcelas ?? grupoItems.length;
        const paidCount = grupoItems.filter((i) => i.paid).length;
        const progressPercent = totalParcelas > 0 ? Math.round((paidCount / totalParcelas) * 100) : 0;

        return (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-bg-muted bg-bg-card p-6 space-y-5">
              <div>
                <h2 className="text-lg font-bold text-white">Status das parcelas</h2>
                <p className="mt-1 text-sm text-text-secondary">{liveItem.title}</p>
              </div>
              {groupQuery.isLoading && (
                <div className="flex items-center justify-center gap-2 py-2 text-sm text-text-secondary">
                  <Loader2 className="h-4 w-4 animate-spin text-accent-lime" />
                  Carregando parcelas...
                </div>
              )}

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Progresso</span>
                  <span className="font-semibold text-accent-lime">{paidCount}/{totalParcelas} pagas</span>
                </div>
                <div className="h-2 w-full rounded-full bg-bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent-lime transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-xs text-text-muted text-right">{progressPercent}% concluído</p>
              </div>

              {grupoItems.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {grupoItems.map((parcel) => (
                    <div
                      key={parcel.id}
                      title={`Parcela ${parcel.numeroParcela} — ${parcel.paid ? "Paga" : "Pendente"}`}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold",
                        parcel.paid ? "bg-accent-lime/20 text-accent-lime" : "bg-bg-muted text-text-secondary",
                        parcel.id === liveItem.id && "ring-2 ring-accent-lime",
                      )}
                    >
                      {parcel.numeroParcela}
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-xl bg-bg-muted p-4 space-y-3 text-sm">
                {liveItem.numeroParcela && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Parcela atual</span>
                    <span className="text-white font-medium">{liveItem.numeroParcela}/{totalParcelas}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-text-secondary">Valor da parcela</span>
                  <span className="text-white font-medium">{formatCurrency(liveItem.value)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Total pago</span>
                  <span className="font-medium text-accent-lime">{formatCurrency(paidCount * liveItem.value)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Falta pagar</span>
                  <span className="font-medium text-accent-red">{formatCurrency((totalParcelas - paidCount) * liveItem.value)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Vencimento</span>
                  <span className="text-white font-medium">{new Date(liveItem.dueDate).toLocaleDateString("pt-BR")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Status</span>
                  <span className={cn("font-medium", liveItem.paid ? "text-accent-lime" : "text-accent-red")}>
                    {liveItem.paid ? "Paga" : "Pendente"}
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setParcelStatusOpen(false)}
                  className="rounded-xl border border-bg-muted px-4 py-2 text-sm text-white hover:bg-bg-muted transition"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      <ConfirmDeleteModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onDeleteOne={() => {
          if (selectedDelete) deletePending.mutate(selectedDelete.id);
          setDeleteModalOpen(false);
        }}
        onDeleteGroup={() => {
          if (selectedDelete?.grupoParceladoId) deleteGroupPending.mutate(selectedDelete.grupoParceladoId);
          setDeleteModalOpen(false);
        }}
        onDeleteMonth={() => {
          if (selectedDelete?.templateId && selectedDelete.month && selectedDelete.year) {
            deleteRecurringMonth.mutate({
              templateId: selectedDelete.templateId,
              month: selectedDelete.month,
              year: selectedDelete.year,
            });
          }
          setDeleteModalOpen(false);
        }}
        onDeletePermanent={() => {
          if (selectedDelete?.templateId) deletePending.mutate(selectedDelete.templateId);
          setDeleteModalOpen(false);
        }}
        accountName={selectedDelete?.title ?? ""}
        isParcel={selectedDelete?.isParcel}
        parcelLabel={selectedDelete?.parcelLabel}
        isRecorrente={selectedDelete?.isRecorrente}
      />
      </section>
  );
}
















































