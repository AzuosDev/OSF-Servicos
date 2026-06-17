import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { api } from "../../lib/api";
import { getApiErrorMessages, setFieldErrorsFromApi } from "../../lib/errors";
import { ModalShell } from "./ModalShell";
import { useCategories } from "./TransactionFormFields";

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

  const { data: categoriesData, isLoading: categoriesLoading } = useCategories();
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
      await api.post("/api/pending", {
        title: formTitle,
        value: Number(formValue),
        dueDate: formDueDate,
        description: formDescription,
        isParcelada: formIsParcelada,
        isRecorrente: formIsRecorrente,
        categoria:
          formCategoria && formCategoria !== "Outro"
            ? formCategoria
            : categoriaCustom,
        formatoPagamento:
          formForma && formForma !== "Outro" ? formForma : formaCustom,
        parcelas: formIsParcelada
          ? { totalParcelas: Number(formParcelas.totalParcelas) }
          : undefined,
        recorrencia: formIsRecorrente
          ? {
              periodoRecorrencia: formRecorrencia.periodoRecorrencia,
              dataProxima: formRecorrencia.dataProxima,
            }
          : undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pending"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
      onSuccess?.();
    },
    onError: (error) => {
      setFieldErrorsFromApi(error, (field, msg) => console.error(field, msg));
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editAccount) return;
      await api.patch(`/api/pending/${editAccount.id}`, {
        title: formTitle,
        value: Number(formValue),
        dueDate: formDueDate,
        description: formDescription,
        isParcelada: formIsParcelada,
        isRecorrente: formIsRecorrente,
        categoria:
          formCategoria && formCategoria !== "Outro"
            ? formCategoria
            : categoriaCustom,
        formatoPagamento:
          formForma && formForma !== "Outro" ? formForma : formaCustom,
        parcelas: formIsParcelada
          ? { totalParcelas: Number(formParcelas.totalParcelas) }
          : undefined,
        recorrencia: formIsRecorrente
          ? {
              periodoRecorrencia: formRecorrencia.periodoRecorrencia,
              dataProxima: formRecorrencia.dataProxima,
            }
          : undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pending"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
      onSuccess?.();
    },
    onError: (error) => {
      setFieldErrorsFromApi(error, (field, msg) => console.error(field, msg));
    },
  });

  const isSaving = createMutation.isPending || editMutation.isPending;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={editAccount ? "Editar Conta Pendentes" : "Nova Conta Pendentes"}
      containerClassName="max-h-[90vh] overflow-y-auto"
    >
      {/* Segmented control */}
      <div className="flex space-x-1 rounded-xl bg-bg-muted p-1 mb-4">
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
          <select
            value={formParcelas.totalParcelas ?? ""}
            onChange={(e) => setFormParcelas({ totalParcelas: e.target.value })}
            className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
          >
            <option value="">Selecione</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="6">6</option>
            <option value="12">12</option>
            <option value="24">24</option>
            <option value="Outro">Outro</option>
          </select>
          {formParcelas.totalParcelas === "Outro" && (
            <input
              type="number"
              placeholder="Outras parcelas"
              className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
              value={formParcelas.totalParcelas}
              onChange={(e) => setFormParcelas({ totalParcelas: e.target.value })}
            />
          )}
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
        {categoriesLoading && <option>Carregando...</option>}
        {categoriesData?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
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
        <option value="Cartão de crédito">Cartão de crédito</option>
        <option value="Pix">Pix</option>
        <option value="Dinheiro">Dinheiro</option>
        <option value="Outro">Outro</option>
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

      <button
        type="button"
        disabled={isSaving}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-lime px-5 py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 mt-4"
        onClick={() => (editAccount ? editMutation.mutate() : createMutation.mutate())}
      >
        {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
        {editAccount ? "Atualizar" : "Salvar"}
      </button>
    </ModalShell>
  );
}
