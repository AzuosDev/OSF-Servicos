import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Wallet } from "lucide-react";

import { api } from "../../lib/api";
import { getApiErrorMessages } from "../../lib/errors";
import { ModalShell } from "./ModalShell";
import { useCategories } from "./TransactionFormFields";
import { DynamicIcon } from "../DynamicIcon";
import { cn } from "../../lib/utils";

const PAYMENT_FORMATS = ["Cartão de Crédito", "Pix", "Dinheiro", "Outro"] as const;

type PaymentFormat = (typeof PAYMENT_FORMATS)[number];

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
    categoria: categoria || undefined,
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
  const categoriesQuery = useCategories();
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
  const [formCategoria, setFormCategoria] = useState("");
  const [categoriaCustom, setCategoriaCustom] = useState("");
  const [formForma, setFormForma] = useState("");
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
      await api.post("/api/pending", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
      onSuccess?.();
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
      onSuccess?.();
    },
  });

  const isSaving = createMutation.isPending || editMutation.isPending;
  const modalTitle = editAccount ? "Editar conta pendente" : "Nova conta pendente";

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={modalTitle}
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
            {editAccount ? "Salvar Alterações" : "Criar Conta"}
          </button>
        </div>
      }
    >
      <p className="mb-4 text-sm text-text-secondary">
        {editAccount
          ? "Atualize as informações da conta pendente."
          : "Cadastre uma conta para acompanhar o pagamento."}
      </p>

      <div className="mb-4 flex gap-1 rounded-xl bg-bg-muted p-1">
        {["Não parcelada", "Parcelada", "Recorrente"].map((type) => (
          <button
            key={type}
            type="button"
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              (formIsParcelada && type === "Parcelada") ||
              (formIsRecorrente && type === "Recorrente") ||
              (!formIsParcelada && !formIsRecorrente && type === "Não parcelada")
                ? "bg-accent-lime text-black"
                : "text-white hover:bg-bg-overlay"
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

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm text-text-secondary">Título</span>
          <input
            type="text"
            placeholder="Ex.: Conta de luz"
            className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none transition focus:border-accent-lime"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-text-secondary">
            {formIsParcelada ? "Valor total" : "Valor"}
          </span>
          <input
            type="number"
            placeholder="R$"
            className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none transition focus:border-accent-lime"
            value={formValue}
            onChange={(e) => setFormValue(e.target.value)}
          />
        </label>

        {formIsParcelada && (
          <label className="block">
            <span className="mb-1 block text-sm text-text-secondary">Quantidade de parcelas</span>
            <input
              type="number"
              min={1}
              step={1}
              placeholder="Ex.: 2"
              value={formParcelas.totalParcelas ?? ""}
              onChange={(e) => setFormParcelas({ totalParcelas: e.target.value })}
              className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none transition focus:border-accent-lime"
            />
            {formParcelas.totalParcelas && formValue && (
              <p className="mt-1 text-xs text-text-secondary">
                Valor da parcela: R$ {(parseFloat(formValue) / Number(formParcelas.totalParcelas)).toFixed(2)}
              </p>
            )}
          </label>
        )}

        {formIsRecorrente && (
          <>
            <label className="block">
              <span className="mb-1 block text-sm text-text-secondary">Período de recorrência</span>
              <select
                value={formRecorrencia.periodoRecorrencia ?? ""}
                onChange={(e) =>
                  setFormRecorrencia((prev) => ({ ...prev, periodoRecorrencia: e.target.value }))
                }
                className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none transition focus:border-accent-lime"
              >
                <option value="Diário">Diário</option>
                <option value="Semanal">Semanal</option>
                <option value="Mensal">Mensal</option>
                <option value="Anual">Anual</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-text-secondary">Próxima data</span>
              <input
                type="date"
                className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none transition focus:border-accent-lime"
                value={formRecorrencia.dataProxima ?? ""}
                onChange={(e) =>
                  setFormRecorrencia((prev) => ({ ...prev, dataProxima: e.target.value }))
                }
              />
            </label>
          </>
        )}

        <div>
          <span className="mb-1 block text-sm text-text-secondary">Categoria</span>
          <div className="max-h-48 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {categoriesQuery.isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-20 animate-pulse rounded-xl bg-bg-muted" />
                  ))
                : (categoriesQuery.data ?? []).map((cat) => {
                    const active = formCategoria === cat.name;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => { setFormCategoria(cat.name); setCategoriaCustom(""); }}
                        className={cn(
                          "flex min-h-20 w-full flex-col items-center justify-center gap-2 rounded-xl border bg-bg-muted p-3 text-center text-xs font-semibold transition",
                          active
                            ? "border-accent-lime text-white"
                            : "border-transparent text-text-secondary hover:border-bg-overlay hover:text-white",
                        )}
                      >
                        <span
                          className="grid h-9 w-9 place-items-center rounded-xl"
                          style={{ backgroundColor: `${cat.color}22` }}
                        >
                          <DynamicIcon name={cat.icon} className="h-5 w-5" style={{ color: cat.color }} />
                        </span>
                        <span className="line-clamp-2">{cat.name}</span>
                      </button>
                    );
                  })}
              <button
                type="button"
                onClick={() => setFormCategoria("Outro")}
                className={cn(
                  "flex min-h-20 w-full flex-col items-center justify-center gap-2 rounded-xl border bg-bg-muted p-3 text-center text-xs font-semibold transition",
                  formCategoria === "Outro"
                    ? "border-accent-lime text-white"
                    : "border-transparent text-text-secondary hover:border-bg-overlay hover:text-white",
                )}
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ backgroundColor: "#6B728022" }}>
                  <DynamicIcon name="MoreHorizontal" className="h-5 w-5" style={{ color: "#6B7280" }} />
                </span>
                <span>Outro</span>
              </button>
            </div>
          </div>
          {formCategoria === "Outro" && (
            <input
              type="text"
              placeholder="Digite a categoria personalizada"
              className="mt-2 w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none transition focus:border-accent-lime"
              value={categoriaCustom}
              onChange={(e) => setCategoriaCustom(e.target.value)}
            />
          )}
        </div>

        <div>
          <span className="mb-1 block text-sm text-text-secondary">Forma de pagamento</span>
          <select
            value={formForma}
            onChange={(e) => {
              setFormForma(e.target.value);
              if (e.target.value !== "Outro") setFormaCustom("");
            }}
            className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none transition focus:border-accent-lime"
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
              className="mt-2 w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none transition focus:border-accent-lime"
              value={formaCustom}
              onChange={(e) => setFormaCustom(e.target.value)}
            />
          )}
        </div>

        <label className="block">
          <span className="mb-1 block text-sm text-text-secondary">Data de vencimento</span>
          <input
            type="date"
            className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none transition focus:border-accent-lime"
            value={formDueDate}
            onChange={(e) => setFormDueDate(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-text-secondary">Descrição (opcional)</span>
          <textarea
            rows={3}
            className="w-full resize-none rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none transition placeholder:text-text-muted focus:border-accent-lime"
            placeholder="Observação opcional"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
          />
        </label>

        {(createMutation.isError || editMutation.isError) && (
          <div className="rounded-xl bg-accent-red/10 p-3 text-sm text-accent-red">
            {getApiErrorMessages(
              createMutation.error || editMutation.error,
              "Não foi possível salvar a conta pendente.",
            ).map((msg) => (
              <p key={msg}>{msg}</p>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
