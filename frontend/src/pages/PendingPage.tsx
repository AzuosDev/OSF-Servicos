import { Clock } from "lucide-react";

export function PendingPage() {
  return (
    <section className="space-y-4">
      <header>
        <p className="text-sm text-text-secondary">Itens em aberto</p>
        <h1 className="text-3xl font-bold">Pendentes</h1>
      </header>
      <div className="rounded-card border border-bg-overlay bg-bg-card p-5">
        <Clock className="mb-3 h-6 w-6 text-accent-lime" />
        <p className="text-sm text-text-secondary">Área preparada para despesas e transações pendentes.</p>
      </div>
    </section>
  );
}
