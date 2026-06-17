import { useMemo, useState } from "react";
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
  parcelas?: { totalParcelas?: number; valorParcela?: number; dataInicio?: string; dataFim?: string; };
  recorrencia?: { periodoRecorrencia?: string; dataProxima?: string; };
  id: string;
  title: string;
  value: number;
  dueDate: string;
  paid: boolean;
  description?: string;
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

export function PendingPage() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [creating, setCreating] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedDelete, setSelectedDelete] = useState<{ id: string; title: string } | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<PendingItem | null>(
    null,
  );
  const [editFormData, setEditFormData] = useState({
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

  // ✅ state dos campos do formulário
  const [formTitle, setFormTitle] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIsParcelada, setFormIsParcelada] = useState(false);
  const [formParcelas, setFormParcelas] = useState({ totalParcelas: "", dataInicio: "", dataFim: "" });
  const [formIsRecorrente, setFormIsRecorrente] = useState(false);
  const [formRecorrencia, setFormRecorrencia] = useState({ periodoRecorrencia: "Mensal", dataProxima: "" });
  const [formCategoria, setFormCategoria] = useState("Outro");
  const [formFormatoPagamento, setFormFormatoPagamento] = useState("Outro");

  const pendingQuery = useQuery<PendingItem[]>({
    queryKey: ["pending"],
    queryFn: async () => {
      const { data } = await api.get<PendingAccount[]>("/api/pending");
      return normalizePending(data);
    },
  });

  const items = pendingQuery.data ?? [];

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
    mutationFn: async (id: string) =>
      api.patch<PendingAccount>(`/api/pending/${id}`, { paid: true }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pending"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      addToast("Conta marcada como paga com sucesso.", "success");
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
    });
  }

  function salvarEdicao() {
    if (!selectedAccount) return;

    editPending.mutate({
      id: selectedAccount.id,
      payload: {
        title: editFormData.title.trim(),
        value: parseFloat(editFormData.value),
        dueDate: new Date(editFormData.dueDate).toISOString(),
        description: editFormData.description.trim() || undefined,
        isParcelada: editFormData.isParcelada,
        isRecorrente: editFormData.isRecorrente,
        categoria: editFormData.categoria,
        formatoPagamento: editFormData.formatoPagamento,
        parcelas: editFormData.isParcelada
          ? {
              totalParcelas: Number(editFormData.parcelas.totalParcelas),
              dataInicio: editFormData.parcelas.dataInicio,
              dataFim: editFormData.parcelas.dataFim,
            }
          : undefined,
        recorrencia: editFormData.isRecorrente
          ? {
              periodoRecorrencia: editFormData.recorrencia.periodoRecorrencia,
              dataProxima: editFormData.recorrencia.dataProxima,
            }
          : undefined,
      },
    });
  }

  function confirmarDeletar(id: string, title: string) {
    setSelectedDelete({ id, title });
    setDeleteModalOpen(true);
  }

  // ✅ mutation para criar conta pendente
  const createPending = useMutation({
    mutationFn: async () => {
      await api.post("/api/pending", {
        title: formTitle.trim(),
        value: parseFloat(formValue),
        dueDate: new Date(formDueDate).toISOString(),
        description: formDescription.trim() || undefined,
        isParcelada: formIsParcelada,
        isRecorrente: formIsRecorrente,
        categoria: formCategoria,
        formatoPagamento: formFormatoPagamento,
        parcelas: formIsParcelada
          ? {
              totalParcelas: Number(formParcelas.totalParcelas),
              dataInicio: formParcelas.dataInicio,
              dataFim: formParcelas.dataFim,
            }
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
    onError: () => addToast("Não foi possível salvar a conta.", "error"),
  });

  return (
    <section className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-text-secondary">Itens em aberto</p>
          <h1 className="text-3xl font-bold">Contas Pendentes</h1>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-xl bg-accent-lime px-4 py-3 text-sm font-bold text-black"
        >
          <Plus className="h-4 w-4" />
          Nova
        </button>
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

      {pendingQuery.isLoading ? (
        <div className="rounded-2xl bg-bg-card p-5 text-sm text-text-secondary">
          Carregando contas...
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const status = statusLabel(item);
            const dueDate = new Date(item.dueDate);

            return (
              <article
                key={item.id}
                className={cn(
                  "rounded-2xl border bg-bg-card p-4 transition",
                  item.paid && "opacity-60",
                  dueDate < new Date() && !item.paid
                    ? "border-accent-red/50"
                    : "border-bg-muted",
                  dueDate.toDateString() === new Date().toDateString() &&
                    !item.paid
                    ? "border-accent-yellow/50"
                    : "",
                )}
              >
                <div className="flex items-start gap-3">
                    {/* Ícones de Parcelada e Recorrente */}
                    {item.isParcelada && (
                      <span className="ml-2 rounded-full bg-accent-lime px-2.5 py-0.5 text-xs font-medium text-white">Parcelada</span>
                    )}
                    {item.isRecorrente && (
                      <span className="ml-2 rounded-full bg-accent-blue px-2.5 py-0.5 text-xs font-medium text-white">Recorrente</span>
                    )}
                    {/* Categoria */}
                    {item.categoria && (
                      <span className="ml-2 rounded-full bg-bg-muted px-2.5 py-0.5 text-xs font-medium text-white">{item.categoria}</span>
                    )}
                    {/* Forma de pagamento */}
                    {item.formatoPagamento && (
                      <span className="ml-2 rounded-full bg-bg-muted px-2.5 py-0.5 text-xs font-medium text-white">{item.formatoPagamento}</span>
                    )}
                  <div className="rounded-2xl bg-bg-muted p-3">
                    <Clock className="h-5 w-5 text-accent-lime" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-white">
                        {item.title}
                      </h2>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                          status.className,
                        )}
                      >
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-text-secondary">
                      {item.description ?? "Conta pendente"}
                    </p>
                    <p className="mt-2 text-xs text-text-muted">
                      Vence em {dueDate.toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">
                      {formatCurrency(item.value)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {!item.paid && (
                    <button
                      type="button"
                      onClick={() => markPaid.mutate(item.id)}
                      disabled={markPaid.isPending}
                      className="inline-flex items-center gap-2 rounded-xl bg-accent-lime/10 px-3 py-2 text-sm font-semibold text-accent-lime hover:bg-accent-lime/20 disabled:opacity-60"
                    >
                      {markPaid.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Marcar como pago
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
      )}

      {creating && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-bg-muted bg-bg-card p-5">
            <h2 className="text-lg font-bold text-white">
              Nova conta pendente
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Cadastre uma conta para acompanhar o pagamento.
            </p>
            <div className="mt-4 space-y-3">
              {/* ✅ inputs controlados com state */}
                {/* Checkbox Parcelada */}
                <div className="flex items-center space-x-2">
                  <input
                    id="isParcelada"
                    type="checkbox"
                    checked={formIsParcelada}
                    onChange={(e) => setFormIsParcelada(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-accent-lime focus:ring-accent-lime"
                  />
                  <label htmlFor="isParcelada" className="text-sm text-white">É parcelada?</label>
                </div>
                {formIsParcelada && (
                  <div className="mt-2 space-y-2">
                    <input
                      type="number"
                      min="1"
                      placeholder="Quantas parcelas?"
                      className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
                      value={formParcelas.totalParcelas}
                      onChange={(e) => setFormParcelas(prev => ({ ...prev, totalParcelas: e.target.value }))}
                    />
                    {/* Valor total já está no campo Valor acima */}
                  </div>
                )}
                {/* Checkbox Recorrente */}
                <div className="flex items-center space-x-2 mt-2">
                  <input
                    id="isRecorrente"
                    type="checkbox"
                    checked={formIsRecorrente}
                    onChange={(e) => setFormIsRecorrente(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-accent-lime focus:ring-accent-lime"
                  />
                  <label htmlFor="isRecorrente" className="text-sm text-white">É recorrente?</label>
                </div>
                {formIsRecorrente && (
                  <div className="mt-2 space-y-2">
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
                    <input
                      type="date"
                      placeholder="Próxima data"
                      className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
                      value={formRecorrencia.dataProxima}
                      onChange={(e) => setFormRecorrencia(prev => ({ ...prev, dataProxima: e.target.value }))}
                    />
                  </div>
                )}
                {/* Dropdown Categoria */}
                <select
                  value={formCategoria}
                  onChange={(e) => setFormCategoria(e.target.value)}
                  className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white mt-2"
                >
                  <option value="Alimentação">Alimentação</option>
                  <option value="Transporte">Transporte</option>
                  <option value="Saúde">Saúde</option>
                  <option value="Educação">Educação</option>
                  <option value="Lazer">Lazer</option>
                  <option value="Outro">Outro</option>
                </select>
                {/* Dropdown Forma de pagamento */}
                <select
                  value={formFormatoPagamento}
                  onChange={(e) => setFormFormatoPagamento(e.target.value)}
                  className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white mt-2"
                >
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Pix">Pix</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Outro">Outro</option>
                </select>
                {/* Checkbox Parcelada */}
                <div className="flex items-center space-x-2">
                  <input
                    id="isParcelada"
                    type="checkbox"
                    checked={formIsParcelada}
                    onChange={(e) => setFormIsParcelada(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-accent-lime focus:ring-accent-lime"
                  />
                  <label htmlFor="isParcelada" className="text-sm text-white">É parcelada?</label>
                </div>
                {formIsParcelada && (
                  <div className="mt-2 space-y-2">
                    <input
                      type="number"
                      min="1"
                      placeholder="Quantas parcelas?"
                      className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
                      value={formParcelas.totalParcelas}
                      onChange={(e) => setFormParcelas(prev => ({ ...prev, totalParcelas: e.target.value }))}
                    />
                    <input
                      type="number"
                      placeholder="Valor total"
                      className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
                      value={formValue}
                      onChange={(e) => setFormValue(e.target.value)}
                    />
                  </div>
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
              <input
                type="date"
                className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
              />
              <textarea
                rows={3}
                className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
                placeholder="Descrição (opcional)"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="rounded-xl border border-bg-muted px-4 py-2 text-sm text-white"
              >
                Cancelar
              </button>
              {/* ✅ onClick chama a mutation */}
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
          <div className="w-full max-w-md rounded-2xl border border-bg-muted bg-bg-card p-5">
            <h2 className="text-lg font-bold text-white">
              Editar conta pendente
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Atualize os dados da conta selecionada.
            </p>
            <div className="mt-4 space-y-3">
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
            <div className="mt-4 flex justify-end gap-2">
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
