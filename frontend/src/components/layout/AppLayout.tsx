import { useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart2,
  ChevronDown,
  Clock,
  Coins,
  Home,
  LayoutDashboard,
  List,
  LogOut,
  Moon,
  Plus,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { clearTokens, getAccessToken } from "../../lib/auth";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";
import { useToast } from "../ui/Toast";

type NavItem = {
  to: string;
  match?: string;
  label: string;
  icon: LucideIcon;
};

const navigation: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/expenses", label: "Gastos", icon: TrendingDown },
  { to: "/transactions?type=INCOME", match: "/transactions?type=INCOME", label: "Ganhos", icon: TrendingUp },
  { to: "/transactions", label: "Transações", icon: List },
  { to: "/pending", label: "Contas Pendentes", icon: Clock },
  { to: "/goals", label: "Metas Financeiras", icon: Target },
] as const;

const mobileNavigation = [
  { to: "/dashboard", label: "Início", icon: Home },
  { to: "/transactions", label: "Resumo", icon: BarChart2 },
  { to: "/pending", label: "Pendentes", icon: Clock },
  { to: "/goals", label: "Metas", icon: Target },
] as const;

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/expenses": "Gastos",
  "/transactions": "Transações",
  "/pending": "Contas Pendentes",
  "/goals": "Metas Financeiras",
  "/budget": "Orçamento",
};

function getUserEmail() {
  const token = getAccessToken();

  if (!token) {
    return "usuario@contacerta.app";
  }

  try {
    const payload = JSON.parse(window.atob(token.split(".")[1] ?? ""));
    return payload.email ?? payload.sub ?? "usuario@contacerta.app";
  } catch {
    return "usuario@contacerta.app";
  }
}

function Avatar({ email }: { email: string }) {
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-bg-muted text-sm font-bold text-accent-lime">
      {email.charAt(0).toUpperCase()}
    </span>
  );
}

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const email = useMemo(getUserEmail, []);
  const currentPath = location.pathname;
  const currentUrl = `${location.pathname}${location.search}`;
  const title = pageTitles[currentPath] ?? "ContaCerta";

  const handleLogout = async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // Ignora falha de logout do servidor e segue com o fluxo local.
    } finally {
      clearTokens();
      addToast("Sessão encerrada com sucesso.", "success");
      navigate("/login", { replace: true });
    }
  };

  const goToCreate = (type: "EXPENSE" | "INCOME") => {
    setAddModalOpen(false);
    navigate(`/transactions?type=${type}&action=create`);
  };

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <aside className="fixed left-0 top-0 hidden h-full w-64 flex-col bg-bg-card lg:flex">
        <Link to="/dashboard" className="flex items-center gap-3 p-6 font-sans text-xl font-bold">
          <Coins className="h-7 w-7 text-accent-lime" />
          ContaCerta
        </Link>

        <nav className="flex flex-1 flex-col gap-1 px-4">
          {navigation.map(({ to, match, label, icon: Icon }) => {
            const active = match ? currentUrl === match : currentPath === to;

            return (
              <Link
                key={`${to}-${label}`}
                to={to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition",
                  active
                    ? "bg-bg-muted text-white"
                    : "text-text-secondary hover:bg-bg-overlay hover:text-white",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "text-accent-lime")} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-bg-muted p-4">
          <div className="flex items-center gap-3">
            <Avatar email={email} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">Usuário</p>
              <p className="truncate text-xs text-text-secondary">{email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-4 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text-secondary transition hover:bg-bg-overlay hover:text-accent-red"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-bg-muted bg-bg-card px-5 py-3 lg:hidden">
        <h1 className="font-sans text-lg font-bold text-white">{title}</h1>
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen((open) => !open)}
            className="flex items-center gap-2 rounded-full bg-bg-muted p-1 pr-2 text-text-secondary"
            aria-label="Abrir menu do usuário"
          >
            <Avatar email={email} />
            <ChevronDown className="h-4 w-4" />
          </button>
          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl border border-bg-muted bg-bg-card p-2 shadow-xl">
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text-secondary hover:bg-bg-overlay hover:text-white">
                <Moon className="h-4 w-4" />
                Tema
              </button>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-text-secondary hover:bg-bg-overlay hover:text-accent-red"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="min-h-screen bg-bg-base p-5 pb-24 lg:ml-64 lg:pb-5">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 z-40 grid w-full grid-cols-5 border-t border-bg-muted bg-bg-card px-3 pb-3 pt-2 lg:hidden">
        {mobileNavigation.slice(0, 2).map(({ to, label, icon: Icon }) => {
          const active = currentPath === to;
          return (
            <Link key={to} to={to} className={cn("flex flex-col items-center gap-1 text-xs", active ? "text-accent-lime" : "text-text-muted")}>
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}

        <button
          onClick={() => setAddModalOpen(true)}
          className="-mt-6 mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent-lime text-black shadow-lg shadow-lime-500/20"
          aria-label="Adicionar transação"
        >
          <Plus className="h-6 w-6" />
        </button>

        {mobileNavigation.slice(2).map(({ to, label, icon: Icon }) => {
          const active = currentPath === to;
          return (
            <Link key={to} to={to} className={cn("flex flex-col items-center gap-1 text-xs", active ? "text-accent-lime" : "text-text-muted")}>
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>

      {addModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 p-4 sm:place-items-center">
          <div className="w-full max-w-sm rounded-2xl border border-bg-muted bg-bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-sans text-lg font-bold">Nova movimentação</h2>
              <button onClick={() => setAddModalOpen(false)} className="rounded-lg px-2 py-1 text-text-secondary hover:bg-bg-overlay hover:text-white">
                Fechar
              </button>
            </div>
            <div className="grid gap-3">
              <button onClick={() => goToCreate("EXPENSE")} className="flex items-center gap-3 rounded-xl bg-bg-muted p-4 text-left hover:bg-bg-overlay">
                <TrendingDown className="h-5 w-5 text-accent-red" />
                <span className="font-semibold">Adicionar Gasto</span>
              </button>
              <button onClick={() => goToCreate("INCOME")} className="flex items-center gap-3 rounded-xl bg-bg-muted p-4 text-left hover:bg-bg-overlay">
                <TrendingUp className="h-5 w-5 text-accent-lime" />
                <span className="font-semibold">Adicionar Ganho</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
