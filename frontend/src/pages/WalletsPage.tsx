import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Eye, EyeOff } from "lucide-react";
import { useShowValues } from "../hooks/useShowValues";

import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { detectBankIcon, getWalletIcon } from "../lib/bankIcons";
import type { Wallet } from "../types/api";

const brlFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
function formatCurrency(v: number) { return brlFormatter.format(v); }

export function WalletsPage() {
  const queryClient = useQueryClient();
  const { show, toggle } = useShowValues();
  const fmt = (v: number) => (show ? brlFormatter.format(v) : "R$ ••••");
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState("");
  const [saldo, setSaldo] = useState("");
  const [icone, setIcone] = useState("🏦");

  const { data: wallets = [], isLoading } = useQuery<Wallet[]>({
    queryKey: ["wallets"],
    queryFn: async () => {
      const { data } = await api.get<Wallet[]>("/api/wallets");
      return Array.isArray(data) ? data : [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/api/wallets", {
        nome: nome.trim(),
        saldo: saldo ? parseFloat(saldo.replace(",", ".")) : 0,
        icone: icone || "🏦",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      setShowForm(false);
      setNome("");
      setSaldo("");
      setIcone("🏦");
    },
  });

  const totalSaldo = wallets.reduce((sum, w) => sum + w.saldo, 0);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-text-secondary">Suas contas</p>
          <h1 className="font-sans text-3xl font-bold">Carteiras</h1>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-xl bg-accent-lime px-4 py-3 text-sm font-bold text-black transition hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          Nova Carteira
        </button>
      </div>

      {/* Saldo total */}
      <div className="rounded-2xl bg-bg-card p-6">
        <p className="text-sm uppercase tracking-widest text-text-secondary">Saldo Total</p>
        <div className="mt-2 flex items-center gap-3">
          <strong className={cn("font-sans text-4xl font-extrabold", totalSaldo < 0 ? "text-accent-red" : "text-accent-lime")}>
            {fmt(totalSaldo)}
          </strong>
          <button
            onClick={toggle}
            className="rounded-lg p-1 text-text-secondary transition hover:text-white"
            aria-label={show ? "Ocultar valores" : "Mostrar valores"}
          >
            {show ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </button>
        </div>
        <p className="mt-1 text-sm text-text-secondary">{wallets.length} carteira{wallets.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Formulário de nova carteira */}
      {showForm && (
        <div className="rounded-2xl bg-bg-card p-5 space-y-4">
          <h2 className="font-bold">Nova Carteira</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block sm:col-span-1">
              <span className="mb-1 block text-sm text-text-secondary">Ícone (emoji)</span>
              <input
                value={icone}
                onChange={(e) => setIcone(e.target.value)}
                placeholder="🏦"
                className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-lime"
              />
            </label>
            <label className="block sm:col-span-1">
              <span className="mb-1 block text-sm text-text-secondary">Nome *</span>
              <input
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value);
                  const auto = detectBankIcon(e.target.value);
                  if (auto) setIcone(auto);
                }}
                placeholder="Ex: Nubank, Caixa…"
                className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-lime"
              />
            </label>
            <label className="block sm:col-span-1">
              <span className="mb-1 block text-sm text-text-secondary">Saldo inicial</span>
              <input
                value={saldo}
                onChange={(e) => setSaldo(e.target.value)}
                placeholder="0,00"
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-lime"
              />
            </label>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 rounded-xl border border-bg-muted py-3 text-sm font-bold transition hover:bg-bg-muted"
            >
              Cancelar
            </button>
            <button
              onClick={() => { if (nome.trim()) createMutation.mutate(); }}
              disabled={createMutation.isPending || !nome.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-lime py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-60"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar Carteira
            </button>
          </div>
        </div>
      )}

      {/* Lista de carteiras */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-bg-muted" />
          ))}
        </div>
      ) : wallets.length === 0 ? (
        <div className="rounded-2xl bg-bg-card p-10 text-center text-text-secondary">
          <p className="text-4xl mb-3">🏦</p>
          <p className="font-semibold">Nenhuma carteira cadastrada ainda.</p>
          <p className="mt-1 text-sm">Clique em "Nova Carteira" para começar.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {wallets.map((wallet) => (
            <Link
              key={wallet._id}
              to={`/carteiras/${wallet._id}`}
              className="flex flex-col gap-3 rounded-2xl bg-bg-card p-5 transition hover:bg-bg-muted"
            >
              <span className="text-3xl">{getWalletIcon(wallet)}</span>
              <div>
                <p className="text-sm text-text-secondary">{wallet.nome}</p>
                <strong className={cn("font-sans text-2xl font-bold", wallet.saldo < 0 ? "text-accent-red" : "text-accent-lime")}>
                  {fmt(wallet.saldo)}
                </strong>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
