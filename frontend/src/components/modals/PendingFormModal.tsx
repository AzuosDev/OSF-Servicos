import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Wallet } from "lucide-react";

import { api } from "../../lib/api";
import { getApiErrorMessages, setFieldErrorsFromApi } from "../../lib/errors";
import { ModalShell } from "./ModalShell";


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

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function buildPendingPayload({
  title,
  value,
  dueDate,
  description,
  isParcelada,
  isRecorrente,
  categoria,
  formatoPagamento,
  parcelas,
  recorrencia,
}: {
  title: string;
  value: string;
  dueDate: string;
  description: string;
  isParcelada: boolean;
  isRecorrente: boolean;
  categoria: string;
  formatoPagamento: string;
  parcelas: { totalParcelas?: string };
  recorrencia: { periodoRecorrencia?: string; dataProxima?: string };
}) {
  const normalizedValue = Number(String(value).replace(/[^\d,-]/g, "").replace(",", "."));
  const baseDate = dueDate ? new Date(dueDate) : undefined;
  const totalParcelas = Number(parcelas.totalParcelas);

  return {
    title: title.trim(),
    value: Number.isFinite(normalizedValue) ? normalizedValue : undefined,
    dueDate: toIsoDate(dueDate),
    description: description.trim() || undefined,
    isParcelada,
    isRecorrente,
    categoria: isPendingCategory(categoria) ? categoria : undefined,
    formatoPagamento: isPaymentFormat(formatoPagamento) ? formatoPagamento : undefined,
    parcelas: isParcelada && baseDate && Number.isFinite(totalParcelas) && totalParcelas > 0
      ? {
          totalParcelas,
          valorParcela: Number((normalizedValue / totalParcelas).toFixed(2)),
          parcelasPagas: 0,
          dataInicio: baseDate.toISOString(),
          dataFim: addMonths(baseDate, totalParcelas - 1).toISOString(),
        }
      : undefined,
    recorrencia: isRecorrente && recorrencia.periodoRecorrencia && recorrencia.dataProxima
      ? {
          periodoRecorrencia: recorrencia.periodoRecorrencia,
          dataProxima: toIsoDate(recorrencia.dataProxima),
        }
      : undefined,
  };
}

type PendingFormModalProps = {
  open: boolean;
  onClose: () => void;
  editAccount?: {
    id: string;
    title: string;
    value: number;
    dueDate: string;
    description?: string;
    isParcelada?: boolean;
    isRecorrente?: boolean;
    categoria?: string;
    formatoPagamento?: string;
    parcelas?: { totalParcelas?: number };
    recorrencia?: { periodoRecorrencia?: string; dataProxima?: string };
  };
  onSuccess?: () => void;
};

export function PendingFormModal({
  open,
  onClose,
  editAccount,
  onSuccess,
}: PendingFormModalProps) {
  const [formIsParcelada, setFormIsParcelada] = useState(false);
  const [formIsRecorrente, setFormIsRecorrente] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formParcelas, setFormParcelas] = useState<{ totalParcelas?: string }>({});
  const [formRecorrencia, setFormRecorrencia] = useState<{
    periodoRecorrencia?: string;
    dataProxima?: string;
  }>({});
  const [formCategoria, setFormCategoria] = useState(""); // id or 'Outro'
  const [categoriaCustom, setCategoriaCustom] = useState("");
  const [formForma, setFormForma] = useState(""); // id or 'Outro'
  const [formaCustom, setFormaCustom] = useState("");

  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      if (editAccount) {
        setFormIsParcelada(!!editAccount.isParcelada);
        setFormIsRecorrente(!!editAccount.isRecorrente);
        setFormTitle(editAccount.title ?? "");
        setFormValue(String(editAccount.value ?? ""));
        setFormDueDate(editAccount.dueDate?.slice(0, 10) ?? "");
        setFormDescription(editAccount.description ?? "");
        setFormParcelas({
          totalParcelas: editAccount.parcelas?.totalParcelas?.toString() ?? "",
        });
        setFormRecorrencia({
          periodoRecorrencia: editAccount.recorrencia?.periodoRecorrencia ?? "",
          dataProxima: editAccount.recorrencia?.dataProxima?.slice(0, 10) ?? "",
        });
        setFormCategoria(editAccount.categoria ?? "");
        setCategoriaCustom(editAccount.categoria ?? "");
        setFormForma(editAccount.formatoPagamento ?? "");
        setFormaCustom(editAccount.formatoPagamento ?? "");
      } else {
        setFormIsParcelada(false);
        setFormIsRecorrente(false);
        setFormTitle("");
        setFormValue("");
        setFormDueDate("");
        setFormDescription("");
        setFormParcelas({});
        setFormRecorrencia({});
        setFormCategoria("");
        setCategoriaCustom("");
        setFormForma("");
        setFormaCustom("");
      }
    }
  }, [open, editAccount]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPendingPayload({
        title: formTitle,
        value: formValue,
        dueDate: formDueDate,
        description: formDescription,
        isParcelada: formIsParcelada,
        isRecorrente: formIsRecorrente,
        categoria: formCategoria && formCategoria !== "Outro" ? formCategoria : categoriaCustom,
        formatoPagamento: formForma && formForma !== "Outro" ? formForma : formaCustom,
        parcelas: formParcelas,
        recorrencia: formRecorrencia,
      });

      console.log("[PendingFormModal] create payload", payload);
      try {
        const response = await api.post("/api/pending", payload);
        console.log("[PendingFormModal] create response", response.data);
      } catch (error) {
        console.error("[PendingFormModal] create error", error);
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pending"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
      onSuccess?.();
    },
    onError: (error) => {
      // exibe no console a mensagem completa do backend
      console.error('Erro ao salvar conta pendente:', error);
      const msg = error?.response?.data?.message || error?.message || 'Erro desconhecido';
      alert(msg);
      setFieldErrorsFromApi(error, (field, msg) => console.error(field, msg));
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/api/pending/${editAccount?.id}`, buildPendingPayload({
        title: formTitle,
        value: formValue,
        dueDate: formDueDate,
        description: formDescription,
        isParcelada: formIsParcelada,
        isRecorrente: formIsRecorrente,
        categoria: formCategoria && formCategoria !== "Outro" ? formCategoria : categoriaCustom,
        formatoPagamento: formForma && formForma !== "Outro" ? formForma : formaCustom,
        parcelas: formParcelas,
        recorrencia: formRecorrencia,
      }));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pending"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
      onSuccess?.();
    },
    onError: (error) => {
      console.error('Erro ao atualizar conta pendente:', error);
      const msg = error?.response?.data?.message || error?.message || 'Erro desconhecido';
      alert(msg);
      setFieldErrorsFromApi(error, (field, msg) => console.error(field, msg));
    },
  });

  const isSaving = createMutation.isPending || editMutation.isPending;
  const title = editAccount ? "Editar conta pendente" : "Nova conta pendente";

  return (
    <ModalShell 
      open={open} 
      onClose={onClose} 
      title={title} 
      icon={<Wallet className="h-6 w-6 text-accent-lime" />}
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            disabled={isSaving}
            className="flex-1 rounded-xl border border-bg-muted bg-transparent px-5 py-3 text-sm font-bold text-white transition hover:bg-bg-overlay disabled:cursor-not-allowed disabled:opacity-70"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSaving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-lime px-5 py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            onClick={() => (editAccount ? editMutation.mutate() : createMutation.mutate())}
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {editAccount ? "Atualizar" : "Salvar"}
          </button>
        </div>
      }
    >
      {/* Descrição */}
      <p className="mb-4 text-sm text-text-secondary">
        Cadastre uma conta para acompanhar o pagamento.
      </p>

      {/* Segmented Control */}
      <div className="mb-6 flex gap-2">
        {["Não parcelada", "Parcelada", "Recorrente"].map((type) => (
          <button
            key={type}
            type="button"
            className={`flex-1 rounded px-3 py-2 text-sm font-medium ${
              (formIsParcelada && type === "Parcelada") ||
              (formIsRecorrente && type === "Recorrente") ||
              (!formIsParcelada && !formIsRecorrente && type === "Não parcelada")
                ? "bg-accent-lime text-black"
                : "text-white"
            }`}
            onClick={() => {
              setFormIsParcelada(type === "Parcelada");
              setFormIsRecorrente(type === "Recorrente");
            }}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Título */}
      <label className="block">
        <span className="mb-1 block text-sm text-text-secondary">Título</span>
        <input
          type="text"
          className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
          value={formTitle}
          onChange={(e) => setFormTitle(e.target.value)}
        />
      </label>

      {/* Valor */}
      <label className="block mt-2">
        <span className="mb-1 block text-sm text-text-secondary">
          {formIsParcelada ? "Valor total" : "Valor"}
        </span>
        <input
          type="number"
          placeholder="R$"
          className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
          value={formValue}
          onChange={(e) => setFormValue(e.target.value)}
        />
      </label>

      {/* Condicionais */}
      {formIsParcelada && (
        <div className="space-y-2 mb-4 mt-2">
          <label className="block text-sm text-white">Quantidade de parcelas</label>
          <input
            type="number"
            min={1}
            step={1}
            placeholder="ex:2"
            value={formParcelas.totalParcelas ?? ""}
            onChange={(e) => {
              setFormParcelas({ totalParcelas: e.target.value });
            }}
            className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
          />
          {formParcelas.totalParcelas && formValue && (
            <p className="text-sm text-text-secondary">
              Valor da parcela: {(parseFloat(formValue) / Number(formParcelas.totalParcelas)).toFixed(2)}
            </p>
          )}
        </div>
      )}

      {formIsRecorrente && (
        <div className="space-y-2 mb-4 mt-2">
          <label className="block text-sm text-white">Período de recorrência</label>
          <select
            value={formRecorrencia.periodoRecorrencia ?? ""}
            onChange={(e) =>
              setFormRecorrencia((prev) => ({ ...prev, periodoRecorrencia: e.target.value }))
            }
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
            value={formRecorrencia.dataProxima ?? ""}
            onChange={(e) =>
              setFormRecorrencia((prev) => ({ ...prev, dataProxima: e.target.value }))
            }
          />
        </div>
      )}

      {/* Categoria */}
      <label className="block text-sm text-white mt-2">Categoria</label>
      <select
        value={formCategoria}
        onChange={(e) => {
          setFormCategoria(e.target.value);
          if (e.target.value !== "Outro") setCategoriaCustom("");
        }}
        className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
      >
        <option value="">Selecione</option>
        {PENDING_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
        <option value="Outro">Outro</option>
      </select>
      {formCategoria === "Outro" && (
        <input
          type="text"
          placeholder="Digite a categoria personalizada"
          className="mt-1 w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
          value={categoriaCustom}
          onChange={(e) => setCategoriaCustom(e.target.value)}
        />
      )}

      {/* Forma de pagamento */}
      <label className="block text-sm text-white mt-2">Forma de pagamento</label>
      <select
        value={formForma}
        onChange={(e) => {
          setFormForma(e.target.value);
          if (e.target.value !== "Outro") setFormaCustom("");
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
      {formForma === "Outro" && (
        <input
          type="text"
          placeholder="Digite a forma de pagamento personalizada"
          className="mt-1 w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
          value={formaCustom}
          onChange={(e) => setFormaCustom(e.target.value)}
        />
      )}

      {/* Data de vencimento */}
      <label className="block text-sm text-white mt-2">Data de vencimento</label>
      <input
        type="date"
        className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
        value={formDueDate}
        onChange={(e) => setFormDueDate(e.target.value)}
      />

      {/* Descrição */}
      <label className="block text-sm text-white mt-2">Descrição (opcional)</label>
      <textarea
        rows={3}
        className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
        value={formDescription}
        onChange={(e) => setFormDescription(e.target.value)}
      />

      {(createMutation.isError || editMutation.isError) && (
        <div className="rounded-xl bg-accent-red/10 p-3 text-sm text-accent-red mt-2">
          {getApiErrorMessages(
            createMutation.error || editMutation.error,
            "Não foi possível salvar a conta pendente.",
          ).map((msg) => (
            <p key={msg}>{msg}</p>
          ))}
        </div>
      )}
    </ModalShell>
  );
}
