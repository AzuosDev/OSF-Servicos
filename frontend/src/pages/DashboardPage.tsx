import { BarChart3, CreditCard, TrendingUp, Wallet } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const chartData = [
  { month: "Jan", balance: 2200 },
  { month: "Fev", balance: 2800 },
  { month: "Mar", balance: 2500 },
  { month: "Abr", balance: 3400 },
  { month: "Mai", balance: 3900 },
  { month: "Jun", balance: 4300 },
];

const cards = [
  { label: "Saldo atual", value: "R$ 4.300", icon: Wallet, color: "text-accent-lime" },
  { label: "Gastos do mês", value: "R$ 1.280", icon: CreditCard, color: "text-accent-orange" },
  { label: "Economia", value: "R$ 620", icon: TrendingUp, color: "text-category-groceries" },
];

export function DashboardPage() {
  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm text-text-secondary">Visão geral</p>
        <h1 className="text-3xl font-bold">Dashboard</h1>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-card border border-bg-overlay bg-bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-secondary">{label}</p>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <strong className="mt-3 block text-2xl">{value}</strong>
          </div>
        ))}
      </div>

      <div className="rounded-card border border-bg-overlay bg-bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-accent-lime" />
          <h2 className="text-lg font-semibold">Evolução do saldo</h2>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <XAxis dataKey="month" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  background: "#141414",
                  border: "1px solid #232323",
                  color: "#FFFFFF",
                }}
              />
              <Area type="monotone" dataKey="balance" stroke="#A3E635" fill="#A3E635" fillOpacity={0.18} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
