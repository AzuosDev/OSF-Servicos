import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Loader2, Plus, Trash2 } from "lucide-react";

import { api } from "../lib/api";
import { formatCurrency } from "../lib/finance";
import { cn } from "../lib/utils";
import { useToast } from "../components/ui/Toast";
import type { PendingAccount } from "../types/api";

type PendingItem = {
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

  if (data && typeof data === "object" && "items" in data && Array.isArray((data as { items?: unknown }).items)) {
    return normalizePending((data as { items: unknown[] }).items);
  }

  return [];
}

function statusLabel(item: PendingItem) {
  const dueDate = new Date(item.dueDate);
  const today = new Date();
  const sameDay = dueDate.toDateString() === today.toDateString();

  if (item.paid) return { label: "Pago", className: "bg-accent-lime/10 text-accent-lime" };
  if (dueDate < today) return { label: "Vencida", className: "bg-accent-red/10 text-accent-red" };
  if (sameDay) return { label: "Vence hoje", className: "bg-accent-yellow/10 text-accent-yellow" };

  return { label: "Pendente", className: "bg-bg-muted text-text-secondary" };
}

export function PendingPage() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [creating, setCreating] = useState(false);

  const pendingQuery = useQuery<PendingItem[]>({
    queryKey: ["pending"],
    queryFn: async () => {
      const { data } = await api.get<PendingAccount[]>("/api/pending");
      return normalizePending(data);
    },
  });

  const items = pendingQuery.data ?? [];

  const totals = useMemo(() => {
    const pendingTotal = items.filter((item) => !item.paid).reduce((sum, item) => sum + item.value, 0);
    const paidTotal = items.filter((item) => item.paid).reduce((sum, item) => sum + item.value, 0);
    return { pendingTotal, paidTotal };
  }, [items]);

  const markPaid = useMutation({
    mutationFn: async (id: string) => api.patch<PendingAccount>(`/api/pending/${id}`, { paid: true }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pending"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      addToast("Conta marcada como paga com sucesso.", "success");
    },
    onError: () => addToast("Não foi possível atualizar a conta.", "error"),
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
          <p className="text-xs uppercase tracking-[0.25em] text-text-muted">Total em aberto</p>
          <p className="mt-3 text-3xl font-bold text-accent-red">{formatCurrency(totals.pendingTotal)}</p>
        </article>
        <article className="rounded-2xl border border-accent-lime/20 bg-bg-card p-5">
          <p className="text-xs uppercase tracking-[0.25em] text-text-muted">Total pago no mês</p>
          <p className="mt-3 text-3xl font-bold text-accent-lime">{formatCurrency(totals.paidTotal)}</p>
        </article>
      </div>

      {pendingQuery.isLoading ? (
        <div className="rounded-2xl bg-bg-card p-5 text-sm text-text-secondary">Carregando contas...</div>
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
                      onClick={() => markPaid.mutate(item.id)}
                      disabled={markPaid.isPending}
                      className="inline-flex items-center gap-2 rounded-xl bg-accent-lime/10 px-3 py-2 text-sm font-semibold text-accent-lime hover:bg-accent-lime/20 disabled:opacity-60"
                    >
                      {markPaid.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Marcar como pago
                    </button>
                  )}
                  <button type="button" className="rounded-xl bg-bg-muted px-3 py-2 text-sm text-white">Editar</button>
                  <button type="button" className="rounded-xl bg-bg-muted px-3 py-2 text-sm text-accent-red"><Trash2 className="h-4 w-4" /></button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-bg-muted bg-bg-card p-5">
            <h2 className="text-lg font-bold text-white">Nova conta pendente</h2>
            <p className="mt-1 text-sm text-text-secondary">Cadastre uma conta para acompanhar o pagamento.</p>
            <div className="mt-4 space-y-3">
              <input className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white" placeholder="Título" />
              <input type="number" className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white" placeholder="Valor" />
              <input type="date" className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white" />
              <textarea rows={3} className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white" placeholder="Descrição (opcional)" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setCreating(false)} className="rounded-xl border border-bg-muted px-4 py-2 text-sm text-white">Cancelar</button>
              <button type="button" className="rounded-xl bg-accent-lime px-4 py-2 text-sm font-bold text-black">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
