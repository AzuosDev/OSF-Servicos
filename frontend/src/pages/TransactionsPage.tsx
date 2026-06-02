import { CreditCard } from "lucide-react";

export function TransactionsPage() {
  return (
    <section className="space-y-4">
      <header>
        <p className="text-sm text-text-secondary">Histórico financeiro</p>
        <h1 className="text-3xl font-bold">Transações</h1>
      </header>
      <div className="rounded-card border border-bg-overlay bg-bg-card p-5">
        <CreditCard className="mb-3 h-6 w-6 text-accent-lime" />
        <p className="text-sm text-text-secondary">Área preparada para acompanhar entradas e saídas.</p>
      </div>
    </section>
  );
}
