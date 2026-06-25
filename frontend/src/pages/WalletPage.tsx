import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowLeftRight, Calendar, Loader2, Pencil, Trash2 } from "lucide-react";

import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { detectBankIcon } from "../lib/bankIcons";
import { getApiErrorMessages } from "../lib/errors";
import { BankLogo } from "../components/ui/BankLogo";
import { useToast } from "../components/ui/Toast";
import type { Transaction, TransactionsResponse, Wallet } from "../types/api";

const brlFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
function fmt(v: number) { return brlFormatter.format(v); }
function formatDate(iso: string) {
  const d = new Date(iso);
  if (!iso || isNaN(d.getTime())) return "--/--/--";
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

function TxRow({ tx }: { tx: Transaction }) {
  const isTransfer = tx.type === "TRANSFER";
  const isIncome = tx.type === "INCOME";
  const label = tx.description || (isIncome ? "Entrada" : isTransfer ? "Transferência" : "Saída");
  const colorCls = tx.agendado
    ? "text-text-muted"
    : isIncome
      ? "text-accent-lime"
      : isTransfer
        ? "text-blue-400"
        : "text-accent-red";
  const sign = isIncome || isTransfer ? "+" : "–";

  return (
    <div className="flex items-center justify-between py-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {isTransfer && <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-blue-400" />}
          <p className="truncate text-sm font-semibold">{label}</p>
          {tx.agendado && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-semibold text-blue-400">
              <Calendar className="h-3 w-3" />
              Agendado
            </span>
          )}
        </div>
        <p className="text-xs text-text-secondary">{formatDate(tx.date)}</p>
      </div>
      <span className={cn("ml-4 shrink-0 font-bold", colorCls)}>
        {sign}{fmt(tx.value)}
      </span>
    </div>
  );
}

export function WalletPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [nome, setNome] = useState("");
  const [icone, setIcone] = useState("");

  const walletQuery = useQuery<Wallet>({
    queryKey: ["wallets", id],
    queryFn: async () => {
      const { data } = await api.get<Wallet>(`/api/wallets/${id}`);
      return data;
    },
    enabled: !!id,
  });
  const wallet = walletQuery.data;

  const txQuery = useInfiniteQuery({
    queryKey: ["transactions", "wallet", id],
    enabled: !!id,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const { data } = await api.get<TransactionsResponse>("/api/transactions", {
        params: { carteiraId: id, page: pageParam, limit: 20 },
      });
      return data;
    },
    getNextPageParam: (last) =>
      last.page * last.limit < last.total ? last.page + 1 : undefined,
  });

  const transactions: Transaction[] = txQuery.data?.pages.flatMap((p) => p.data) ?? [];

  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/api/wallets/${id}`, {
        nome: nome || wallet?.nome,
        icone: icone || wallet?.icone,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/api/wallets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      navigate("/carteiras");
    },
    onError: (error) => {
      addToast(
        getApiErrorMessages(error, "Não foi possível excluir a carteira.")[0] ??
          "Não foi possível excluir a carteira.",
        "error",
      );
    },
  });

  if (walletQuery.isLoading) {
    return (
      <section className="space-y-6">
        <div className="h-32 animate-pulse rounded-2xl bg-bg-muted" />
        <div className="h-64 animate-pulse rounded-2xl bg-bg-muted" />
      </section>
    );
  }

  if (!wallet) {
    return (
      <div className="rounded-2xl bg-bg-card p-8 text-center text-text-secondary">
        Carteira não encontrada.{" "}
        <Link to="/carteiras" className="text-accent-lime underline">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="rounded-xl p-2 transition hover:bg-bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <p className="text-sm text-text-secondary">Carteira</p>
          <h1 className="font-sans text-2xl font-bold">{wallet.nome}</h1>
        </div>
      </div>

      {/* Card de saldo */}
      <div className="rounded-2xl bg-bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <BankLogo nome={wallet.nome} icone={wallet.icone} className="h-12 w-12" />
            <p className="mt-3 text-sm uppercase tracking-widest text-text-secondary">Saldo</p>
            <strong
              className={cn(
                "mt-1 block font-sans text-3xl font-extrabold",
                wallet.saldo < 0 ? "text-accent-red" : "text-accent-lime",
              )}
            >
              {fmt(wallet.saldo)}
            </strong>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setNome(wallet.nome);
                setIcone(wallet.icone ?? "");
                setEditing(true);
              }}
              className="rounded-xl border border-bg-muted p-2 transition hover:bg-bg-muted"
              title="Editar"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                if (confirm("Excluir esta carteira?")) deleteMutation.mutate();
              }}
              disabled={deleteMutation.isPending}
              className="rounded-xl border border-accent-red/30 p-2 text-accent-red transition hover:bg-accent-red/10 disabled:opacity-50"
              title="Excluir"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Formulário de edição */}
      {editing && (
        <div className="space-y-4 rounded-2xl bg-bg-card p-5">
          <h2 className="font-bold">Editar Carteira</h2>
          <label className="block">
            <span className="mb-1 block text-sm text-text-secondary">Nome</span>
            <input
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
                const auto = detectBankIcon(e.target.value);
                if (auto) setIcone(auto);
              }}
              className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-lime"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-text-secondary">Ícone (emoji)</span>
            <input
              value={icone}
              onChange={(e) => setIcone(e.target.value)}
              placeholder="🏦"
              className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-lime"
            />
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setEditing(false)}
              className="flex-1 rounded-xl border border-bg-muted py-3 text-sm font-bold transition hover:bg-bg-muted"
            >
              Cancelar
            </button>
            <button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="flex-1 rounded-xl bg-accent-lime py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-60"
            >
              Salvar
            </button>
          </div>
        </div>
      )}

      {/* Extrato */}
      <div className="rounded-2xl bg-bg-card p-5">
        <h2 className="mb-4 font-sans text-xl font-bold">Extrato</h2>

        {txQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-bg-muted" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-secondary">
            Nenhuma movimentação vinculada a esta carteira.
          </p>
        ) : (
          <div className="divide-y divide-bg-muted">
            {transactions.map((tx) => (
              <TxRow key={tx._id} tx={tx} />
            ))}
          </div>
        )}

        {txQuery.hasNextPage && (
          <button
            type="button"
            onClick={() => txQuery.fetchNextPage()}
            disabled={txQuery.isFetchingNextPage}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-bg-muted px-4 py-3 text-sm font-semibold text-white hover:bg-bg-muted disabled:opacity-60"
          >
            {txQuery.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
            Carregar mais
          </button>
        )}
      </div>
    </section>
  );
}
