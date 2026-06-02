import { Target } from "lucide-react";

export function GoalsPage() {
  return (
    <section className="space-y-4">
      <header>
        <p className="text-sm text-text-secondary">Objetivos</p>
        <h1 className="text-3xl font-bold">Metas</h1>
      </header>
      <div className="rounded-card border border-bg-overlay bg-bg-card p-5">
        <Target className="mb-3 h-6 w-6 text-accent-lime" />
        <p className="text-sm text-text-secondary">Área preparada para acompanhar suas metas financeiras.</p>
      </div>
    </section>
  );
}
