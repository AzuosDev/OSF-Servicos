import { Link, useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Pencil, Trash2, ArrowLeftRight } from "lucide-react";
import { useState } from "react";

import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { detectBankIcon } from "../lib/bankIcons";
import { BankLogo } from "../components/ui/BankLogo";
import type { Wallet, Transaction } from "../types/api";

type WalletDetail = Wallet & { transactions: Transaction[] };

const brlFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
function formatCurrency(v: number) { return brlFormatter.format(v); }

function formatDate(iso: string) {
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d.getTime())) return "--/--/--";
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

export function WalletPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [nome, setNome] = useState("");
  const [icone, setIcone] = useState("");

  const { data: wallet, isLoading } = useQuery<WalletDetail>({
    queryKey: ["wallets", id],
    queryFn: async () => {
      const { data } = await api.get<WalletDetail>(`/api/wallets/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/api/wallets/${id}`, { nome: nome || wallet?.nome, icone: icone || wallet?.icone });
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
      navigate("/dashboard");
    },
  });

  if (isLoading) {
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
        <Link to="/dashboard" className="text-accent-lime underline">Voltar</Link>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-xl p-2 transition hover:bg-bg-muted">
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
            <strong className={cn("mt-1 block font-sans text-3xl font-extrabold", wallet.saldo < 0 ? "text-accent-red" : "text-accent-lime")}>
              {formatCurrency(wallet.saldo)}
            </strong>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setNome(wallet.nome); setIcone(wallet.icone ?? ""); setEditing(true); }}
              className="rounded-xl border border-bg-muted p-2 transition hover:bg-bg-muted"
              title="Editar"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => { if (confirm("Excluir esta carteira?")) deleteMutation.mutate(); }}
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
        <div className="rounded-2xl bg-bg-card p-5 space-y-4">
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

      {/* Transações da carteira */}
      <div className="rounded-2xl bg-bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-sans text-xl font-bold">Movimentações</h2>
          <ArrowLeftRight className="h-5 w-5 text-text-secondary" />
        </div>

        {wallet.transactions.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-secondary">Nenhuma movimentação vinculada a esta carteira.</p>
        ) : (
          <div className="divide-y divide-bg-muted">
            {wallet.transactions.map((tx) => (
              <div key={tx._id} className="flex items-center justify-between py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{tx.description || (tx.type === "INCOME" ? "Entrada" : tx.type === "TRANSFER" ? "Transferência" : "Saída")}</p>
                    {tx.agendado && (
                      <span className="flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-semibold text-blue-400">
                        <Calendar className="h-3 w-3" />
                        Agendado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary">{formatDate(tx.date)}</p>
                </div>
                <span className={cn("font-bold", tx.agendado ? "text-text-muted" : tx.type === "INCOME" ? "text-accent-lime" : tx.type === "TRANSFER" ? "text-text-secondary" : "text-accent-red")}>
                  {tx.type === "EXPENSE" ? "–" : "+"}{formatCurrency(tx.value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
