import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trophy } from "lucide-react";

import { useToast } from "../components/ui/Toast";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/finance";
import type { Goal as ApiGoal } from "../types/api";

type Goal = {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string;
};

function normalizeGoals(data: unknown): Goal[] {
  if (Array.isArray(data)) {
    return data.map((item) => ({
      id: item._id ?? item.id,
      name: item.name,
      target: item.targetValue ?? item.target ?? 0,
      current: item.currentValue ?? item.current ?? 0,
      deadline: item.deadline ?? "",
    }));
  }

  if (data && typeof data === "object" && "items" in data && Array.isArray((data as { items?: unknown }).items)) {
    return normalizeGoals((data as { items: unknown[] }).items);
  }

  return [];
}

export function GoalsPage() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);

  const goalsQuery = useQuery<Goal[]>({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data } = await api.get<ApiGoal[]>("/api/goals");
      return normalizeGoals(data);
    },
  });

  const goals = goalsQuery.data ?? [];

  const totalProgress = useMemo(() => {
    const target = goals.reduce((sum, goal) => sum + goal.target, 0);
    const current = goals.reduce((sum, goal) => sum + goal.current, 0);
    return target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  }, [goals]);

  const updateGoal = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: number }) => api.patch<ApiGoal>(`/api/goals/${id}`, { currentValue: value }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["goals"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      addToast("Meta atualizada com sucesso.", "success");
      setSelectedId(null);
    },
    onError: () => addToast("Não foi possível atualizar a meta.", "error"),
  });

  return (
    <section className="space-y-5">
      <header>
        <p className="text-sm text-text-secondary">Objetivos</p>
        <h1 className="text-3xl font-bold">Metas financeiras</h1>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-2xl border border-bg-muted bg-bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text-secondary">Progresso geral</p>
              <h2 className="text-2xl font-semibold text-white">{totalProgress}% concluído</h2>
            </div>
            <div className="grid h-20 w-20 place-items-center rounded-full border border-accent-lime/30 bg-bg-muted text-accent-lime font-bold">{totalProgress}%</div>
          </div>
          <p className="mt-3 text-sm text-text-secondary">Você está no caminho certo para atingir suas metas de curto e médio prazo.</p>
        </article>

        <article className="rounded-2xl border border-accent-lime/20 bg-bg-card p-5">
          <div className="flex items-center gap-2 text-accent-lime">
            <Trophy className="h-5 w-5" />
            <p className="text-sm font-semibold">Resumo</p>
          </div>
          <p className="mt-3 text-3xl font-bold text-white">{formatCurrency(goals.reduce((sum, goal) => sum + goal.current, 0))}</p>
          <p className="text-sm text-text-secondary">Acumulado até agora em relação a {formatCurrency(goals.reduce((sum, goal) => sum + goal.target, 0))} de meta.</p>
        </article>
      </div>

      {goalsQuery.isLoading ? (
        <div className="rounded-2xl bg-bg-card p-5 text-sm text-text-secondary">Carregando metas...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((goal) => {
            const progress = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
            const remaining = Math.max(0, goal.target - goal.current);
            return (
              <article key={goal.id} className="rounded-2xl border border-bg-muted bg-bg-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-text-secondary">Meta</p>
                    <h3 className="text-xl font-semibold text-white">{goal.name}</h3>
                  </div>
                  <div className="rounded-full bg-accent-lime/10 px-3 py-1 text-xs font-semibold text-accent-lime">{progress}%</div>
                </div>

                <div className="mt-4 flex items-center gap-4">
                  <svg viewBox="0 0 120 120" className="h-20 w-20 -rotate-90">
                    <circle cx="60" cy="60" r="48" stroke="rgba(148,163,184,0.18)" strokeWidth="10" fill="none" />
                    <circle cx="60" cy="60" r="48" stroke="#A3E635" strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={301.6} strokeDashoffset={301.6 - (301.6 * progress) / 100} />
                  </svg>
                  <div className="space-y-1 text-sm text-text-secondary">
                    <p>Atual: <span className="font-semibold text-white">{formatCurrency(goal.current)}</span></p>
                    <p>Meta: <span className="font-semibold text-white">{formatCurrency(goal.target)}</span></p>
                    <p>Faltam: <span className="font-semibold text-accent-lime">{formatCurrency(remaining)}</span></p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(goal.id);
                    setAmount(goal.current);
                  }}
                  className="mt-4 rounded-xl bg-bg-muted px-4 py-2 text-sm font-semibold text-white"
                >
                  Atualizar valor
                </button>
              </article>
            );
          })}
        </div>
      )}

      {selectedId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-bg-muted bg-bg-card p-5">
            <h2 className="text-lg font-bold text-white">Atualizar meta</h2>
            <p className="mt-1 text-sm text-text-secondary">Digite o valor atual acumulado na meta.</p>
            <input
              type="number"
              value={amount}
              onChange={(event) => setAmount(Number(event.target.value))}
              className="mt-4 w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setSelectedId(null)} className="rounded-xl border border-bg-muted px-4 py-2 text-sm text-white">Cancelar</button>
              <button
                type="button"
                onClick={() => {
                  const goal = goals.find((item) => item.id === selectedId);
                  if (!goal) return;
                  updateGoal.mutate({ id: goal.id, value: amount });
                }}
                disabled={updateGoal.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-accent-lime px-4 py-2 text-sm font-bold text-black disabled:opacity-60"
              >
                {updateGoal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
