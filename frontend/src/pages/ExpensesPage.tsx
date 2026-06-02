import { CircleDollarSign } from "lucide-react";

export function ExpensesPage() {
  return (
    <section className="space-y-4">
      <header>
        <p className="text-sm text-text-secondary">Controle de gastos</p>
        <h1 className="text-3xl font-bold">Gastos</h1>
      </header>
      <div className="rounded-card border border-bg-overlay bg-bg-card p-5">
        <CircleDollarSign className="mb-3 h-6 w-6 text-accent-lime" />
        <p className="text-sm text-text-secondary">Área preparada para listar e cadastrar despesas.</p>
      </div>
    </section>
  );
}
