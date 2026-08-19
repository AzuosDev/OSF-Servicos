import { lazy, Suspense, useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeftRight,
  BarChart2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  CircleDollarSign,
  Clock,
  FileBarChart,
  FileText,
  Home,
  Landmark,
  LayoutDashboard,
  List,
  LogOut,
  Menu,
  Moon,
  Plus,
  Settings,
  Sparkles,
  Sun,
  Target,
  TrendingDown,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useTheme } from "../../hooks/useTheme";
import { useAuth } from "../../contexts/AuthContext";
import { NotificationBell } from "../NotificationBell";
import { useInactivityLock } from "../../hooks/useInactivityLock";
import { clearTokens, getAccessToken, getRefreshToken } from "../../lib/auth";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";
import type { User } from "../../types/api";
import { useToast } from "../ui/Toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { WebAuthnSuggestionModal } from "../modals/WebAuthnSuggestionModal";
import { PixBillingReminderModal } from "../modals/PixBillingReminderModal";
import { useWebAuthnSuggestion } from "../../hooks/useWebAuthnSuggestion";
import { hasSeenWhatsNew } from "../modals/WhatsNewModal";
const TransactionModal = lazy(() =>
  import("../modals/TransactionModal").then((m) => ({ default: m.TransactionModal }))
);
const WhatsNewModal = lazy(() =>
  import("../modals/WhatsNewModal").then((m) => ({ default: m.WhatsNewModal }))
);

type NavLeaf = {
  to: string;
  match?: string;
  label: string;
  icon: LucideIcon;
};

type NavGroup = {
  label: string;
  icon: LucideIcon;
  children: NavLeaf[];
};

type NavEntry = NavLeaf | NavGroup;

function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "children" in entry;
}

function isLeafActive(item: NavLeaf, currentPath: string, currentUrl: string) {
  if (item.match) {
    return currentUrl === item.match;
  }
  return currentPath === item.to || currentPath.startsWith(`${item.to}/`);
}

function activeGroupLabels(entries: NavEntry[], currentPath: string, currentUrl: string) {
  return entries
    .filter(isNavGroup)
    .filter((group) => group.children.some((child) => isLeafActive(child, currentPath, currentUrl)))
    .map((group) => group.label);
}

const navigation: NavEntry[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/orcamentos", label: "Orçamentos", icon: FileText },
  {
    label: "Serviços",
    icon: Wrench,
    children: [
      { to: "/agenda", label: "Agenda", icon: CalendarDays },
      { to: "/servicos", label: "Serviços", icon: Zap },
    ],
  },
  {
    label: "Finanças",
    icon: Landmark,
    children: [
      { to: "/contas-a-receber", label: "A Receber", icon: CircleDollarSign },
      { to: "/transactions", label: "Transações", icon: List },
      { to: "/carteiras", label: "Carteiras", icon: Landmark },
      { to: "/contas", label: "Contas", icon: Clock },
      { to: "/goals", label: "Metas Financeiras", icon: Target },
    ],
  },
  {
    label: "Relatórios",
    icon: FileBarChart,
    children: [
      { to: "/relatorios", label: "Relatórios", icon: FileBarChart },
      { to: "/insights", label: "Insights", icon: Sparkles },
      { to: "/resumo", label: "Resumo", icon: TrendingDown },
    ],
  },
];

const mobileNavigation = [
  { to: "/dashboard", label: "Início", icon: Home },
  { to: "/resumo", label: "Resumo", icon: BarChart2 },
  { to: "/contas", label: "Contas", icon: Clock },
  { to: "/goals", label: "Metas", icon: Target },
] as const;

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/agenda": "Agenda",
  "/servicos": "Serviços",
  "/orcamentos": "Orçamentos",
  "/orcamentos/novo": "Novo Orçamento",
  "/contas-a-receber": "Contas a Receber",
  "/relatorios": "Relatórios",
  "/insights": "Insights",
  "/resumo": "Resumo",
  "/transactions": "Transações",
  "/carteiras": "Carteiras",
  "/contas": "Contas",
  "/goals": "Metas Financeiras",
  "/budget": "Orçamento",
  "/configuracoes": "Configurações",
};

const fallbackEmail = "udawgs.org@gmail.com";

function isEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getUserEmailFromToken() {
  const token = getAccessToken();

  if (!token) {
    return null;
  }

  try {
    const payload = JSON.parse(window.atob(token.split(".")[1] ?? ""));
    return isEmail(payload.email) ? payload.email : null;
  } catch {
    return null;
  }
}

function Avatar({ email, name, avatarUrl }: { email: string; name?: string; avatarUrl?: string }) {
  const [imgError, setImgError] = useState(false);
  const letter = (name || email).charAt(0).toUpperCase();

  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name || email}
        className="h-10 w-10 shrink-0 rounded-full object-cover"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-bg-muted text-sm font-bold text-accent-gold">
      {letter}
    </span>
  );
}

function ThemeToggleButton({ collapsed = false }: { collapsed?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? "Tema claro" : "Tema escuro";

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "group relative flex w-full items-center rounded-xl px-3 py-2.5 text-sm text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary",
        collapsed ? "justify-center" : "gap-3",
      )}
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      title={collapsed ? label : undefined}
    >
      <Icon className="h-4 w-4" />
      {!collapsed && <span>{label}</span>}
      {collapsed && (
        <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-border-default bg-bg-card px-3 py-2 text-xs font-semibold text-text-primary opacity-0 shadow-xl transition group-hover:opacity-100">
          {label}
        </span>
      )}
    </button>
  );
}

type SidebarContentProps = {
  currentPath: string;
  currentUrl: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  onLogout: () => void;
  onNavigate?: () => void;
  onOpenProfile?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onBillingReminderClick?: () => void;
};

function SidebarContent({
  currentPath,
  currentUrl,
  email,
  name,
  avatarUrl,
  onLogout,
  onNavigate,
  onOpenProfile,
  collapsed = false,
  onToggleCollapse,
  onBillingReminderClick,
}: SidebarContentProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(activeGroupLabels(navigation, currentPath, currentUrl)),
  );
  const { theme } = useTheme();
  const logoSrc = theme === "light" ? "/branding/osf-logo-light.png" : "/branding/osf-logo-dark.png";

  useEffect(() => {
    const active = activeGroupLabels(navigation, currentPath, currentUrl);
    if (active.length === 0) return;
    setExpandedGroups((prev) => {
      const missing = active.filter((label) => !prev.has(label));
      if (missing.length === 0) return prev;
      return new Set([...prev, ...missing]);
    });
  }, [currentPath, currentUrl]);

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-3 p-6",
          collapsed ? "justify-center px-4" : "justify-between",
        )}
      >
        {onToggleCollapse ? (
          <>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="shrink-0 transition hover:opacity-75"
              aria-label={collapsed ? "Expandir menu lateral" : "Comprimir menu lateral"}
              title={collapsed ? "Expandir menu" : "Comprimir menu"}
            >
              <img
                src={logoSrc}
                alt="OSF Serviços"
                className="h-7 w-7 rounded-md object-contain"
              />
            </button>
            {!collapsed && (
              <Link
                to="/dashboard"
                onClick={onNavigate}
                className="truncate font-sans text-xl font-bold text-text-primary"
              >
                OSF Serviços
              </Link>
            )}
          </>
        ) : (
          <Link
            to="/dashboard"
            onClick={onNavigate}
            className={cn(
              "flex min-w-0 items-center gap-3 font-sans text-xl font-bold text-text-primary",
              collapsed && "justify-center",
            )}
            title={collapsed ? "OSF Serviços" : undefined}
          >
            <img
              src={logoSrc}
              alt="OSF Serviços"
              className="h-7 w-7 shrink-0 rounded-md object-contain"
            />
            {!collapsed && <span className="truncate">OSF Serviços</span>}
          </Link>
        )}

        {onToggleCollapse && !collapsed && (
          <button
            onClick={onToggleCollapse}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-bg-muted text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
            aria-label="Comprimir menu lateral"
            title="Comprimir menu"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav
        className={cn(
          "flex flex-1 flex-col gap-1",
          collapsed ? "px-3" : "px-4",
        )}
      >
        {navigation.map((entry) => {
          if (!isNavGroup(entry)) {
            const { to, label, icon: Icon } = entry;
            const active = isLeafActive(entry, currentPath, currentUrl);

            return (
              <Link
                key={to}
                to={to}
                onClick={onNavigate}
                title={collapsed ? label : undefined}
                className={cn(
                  "group relative flex items-center rounded-xl py-3 text-sm font-medium transition",
                  collapsed ? "justify-center px-3" : "gap-3 px-4",
                  active
                    ? "bg-bg-muted text-text-primary"
                    : "text-text-secondary hover:bg-bg-overlay hover:text-text-primary",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "text-accent-gold")} />
                {!collapsed && <span>{label}</span>}
                {collapsed && (
                  <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-border-default bg-bg-card px-3 py-2 text-xs font-semibold text-text-primary opacity-0 shadow-xl transition group-hover:opacity-100">
                    {label}
                  </span>
                )}
              </Link>
            );
          }

          const GroupIcon = entry.icon;
          const groupActive = entry.children.some((child) => isLeafActive(child, currentPath, currentUrl));

          if (collapsed) {
            return (
              <div key={entry.label} className="group relative">
                <div
                  className={cn(
                    "flex items-center justify-center rounded-xl px-3 py-3",
                    groupActive ? "text-accent-gold" : "text-text-secondary",
                  )}
                  title={entry.label}
                >
                  <GroupIcon className="h-5 w-5" />
                </div>
                <div className="pointer-events-none absolute left-full top-0 z-50 ml-3 min-w-[180px] rounded-xl border border-border-default bg-bg-card p-1.5 opacity-0 shadow-xl transition group-hover:pointer-events-auto group-hover:opacity-100">
                  <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {entry.label}
                  </p>
                  {entry.children.map((child) => {
                    const ChildIcon = child.icon;
                    const active = isLeafActive(child, currentPath, currentUrl);
                    return (
                      <Link
                        key={child.to}
                        to={child.to}
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
                          active
                            ? "bg-bg-muted text-text-primary"
                            : "text-text-secondary hover:bg-bg-overlay hover:text-text-primary",
                        )}
                      >
                        <ChildIcon className={cn("h-4 w-4", active && "text-accent-gold")} />
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          }

          const expanded = expandedGroups.has(entry.label);

          return (
            <div key={entry.label}>
              <button
                type="button"
                onClick={() => toggleGroup(entry.label)}
                aria-expanded={expanded}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition",
                  groupActive
                    ? "text-text-primary"
                    : "text-text-secondary hover:bg-bg-overlay hover:text-text-primary",
                )}
              >
                <GroupIcon className={cn("h-5 w-5", groupActive && "text-accent-gold")} />
                <span className="flex-1 text-left">{entry.label}</span>
                <ChevronDown
                  className={cn("h-4 w-4 shrink-0 transition-transform", expanded && "rotate-180")}
                />
              </button>
              {expanded && (
                <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-border-default pl-3">
                  {entry.children.map((child) => {
                    const ChildIcon = child.icon;
                    const active = isLeafActive(child, currentPath, currentUrl);
                    return (
                      <Link
                        key={child.to}
                        to={child.to}
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                          active
                            ? "bg-bg-muted text-text-primary"
                            : "text-text-secondary hover:bg-bg-overlay hover:text-text-primary",
                        )}
                      >
                        <ChildIcon className={cn("h-4 w-4", active && "text-accent-gold")} />
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className={cn("px-4 pb-1", collapsed && "px-3")}>
        <NotificationBell collapsed={collapsed} onBillingReminderClick={onBillingReminderClick} />
      </div>

      <div
        className={cn(
          "border-t border-border-default p-4",
          collapsed && "px-3",
        )}
      >
        <div className="relative">
          <div
            className={cn(
              "flex items-center gap-3",
              collapsed && "justify-center",
            )}
          >
            <button
              type="button"
              onClick={collapsed ? () => setUserMenuOpen((v) => !v) : onOpenProfile}
              className="shrink-0 rounded-full transition hover:ring-2 hover:ring-accent-gold/50 focus:outline-none"
              title={collapsed ? (name || email) : "Abrir configurações"}
              aria-label={collapsed ? "Menu do usuário" : "Abrir configurações"}
            >
              <Avatar email={email} name={name} avatarUrl={avatarUrl} />
            </button>
            {!collapsed && (
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                className="min-w-0 flex-1 text-left transition hover:opacity-80"
                aria-label="Menu do usuário"
              >
                <p className="truncate text-sm font-semibold text-text-primary">
                  {name || email.split("@")[0]}
                </p>
                <p className="truncate text-xs text-text-secondary">{email}</p>
              </button>
            )}
          </div>

          {userMenuOpen && (
            <>
              <button
                className="fixed inset-0 z-10 h-full w-full cursor-default"
                onClick={() => setUserMenuOpen(false)}
                aria-hidden="true"
                tabIndex={-1}
              />
              <div
                className={cn(
                  "absolute z-20 min-w-[180px] rounded-xl border border-border-default bg-bg-card p-1 shadow-xl",
                  collapsed
                    ? "bottom-0 left-full ml-3"
                    : "bottom-full left-0 mb-2 w-full",
                )}
              >
                <button
                  onClick={() => { setUserMenuOpen(false); onOpenProfile?.(); }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
                >
                  <Settings className="h-4 w-4" />
                  Configurações
                </button>
                <button
                  onClick={() => { setUserMenuOpen(false); onLogout(); }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary transition hover:bg-bg-overlay hover:text-accent-red"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </div>
            </>
          )}
        </div>

        <div className="mt-4 grid gap-1">
          <ThemeToggleButton collapsed={collapsed} />
        </div>
      </div>
    </>
  );
}

import { createContext, useContext } from "react";

function MobileNotificationBell({ onBillingReminderClick }: { onBillingReminderClick?: () => void }) {
  return <NotificationBell openDirection="down" iconOnly onBillingReminderClick={onBillingReminderClick} />;
}

export const TransactionModalContext = createContext<{ open: boolean; setOpen: React.Dispatch<React.SetStateAction<boolean>> }>({
  open: false,
  setOpen: () => {},
});

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { lock, isLocked } = useAuth();
  useInactivityLock(lock, isLocked);
  const [whatsNewOpen, setWhatsNewOpen] = useState(() => !hasSeenWhatsNew());
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [txOpen, setTxOpen] = useState(false);
  const [txTab, setTxTab] = useState<"INCOME" | "EXPENSE" | "TRANSFER">("EXPENSE");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [billingReminderOpen, setBillingReminderOpen] = useState(false);
  const webAuthnSuggestion = useWebAuthnSuggestion();

  const [email, setEmail] = useState(
    () => getUserEmailFromToken() ?? fallbackEmail,
  );
  const userQuery = useQuery<User>({
    queryKey: ["user-profile"],
    queryFn: () => api.get<User>("/api/users/me").then((r) => r.data),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
  const name = userQuery.data?.name;
  const avatarUrl = userQuery.data?.avatarUrl;

  const currentPath = location.pathname;
  const currentUrl = `${location.pathname}${location.search}`;
  const title = pageTitles[currentPath] ?? "OSF Serviços";

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const tokenEmail = getUserEmailFromToken();

    if (tokenEmail) {
      setEmail(tokenEmail);
      return;
    }

    let active = true;

    api
      .get<User>("/api/auth/me")
      .then(({ data }) => {
        if (active && isEmail(data.email)) {
          setEmail(data.email);
        }
      })
      .catch(() => {
        if (active) {
          setEmail(fallbackEmail);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      const refreshToken = getRefreshToken();
      await api.post("/api/auth/logout", { refreshToken });
    } catch {
      // Ignora falha de logout do servidor e segue com o fluxo local.
    } finally {
      clearTokens();
      queryClient.clear();
      addToast("Sessão encerrada com sucesso.", "success");
      navigate("/login", { replace: true });
    }
  };

  const openTx = (tab: "INCOME" | "EXPENSE" | "TRANSFER") => {
    setAddModalOpen(false);
    setTxTab(tab);
    setTxOpen(true);
  };

  return (
    <TransactionModalContext.Provider value={{ open: addModalOpen, setOpen: setAddModalOpen }}>
        <div className="min-h-screen bg-bg-base text-text-primary">
      <aside
        className={cn(
          "fixed left-0 top-0 hidden h-full flex-col bg-bg-card transition-[width] duration-200 lg:flex",
          desktopSidebarCollapsed ? "w-20" : "w-64",
        )}
      >
        <SidebarContent
          currentPath={currentPath}
          currentUrl={currentUrl}
          email={email}
          name={name}
          avatarUrl={avatarUrl}
          onLogout={handleLogout}
          onOpenProfile={() => navigate("/configuracoes")}
          onBillingReminderClick={() => setBillingReminderOpen(true)}
          collapsed={desktopSidebarCollapsed}
          onToggleCollapse={() =>
            setDesktopSidebarCollapsed((collapsed) => !collapsed)
          }
        />
      </aside>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 h-full w-full bg-black/60"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Fechar menu lateral"
          />
          <aside className="relative flex h-full w-[min(20rem,86vw)] flex-col bg-bg-card shadow-2xl">
            <div className="absolute right-3 top-3">
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-xl bg-bg-muted text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
                aria-label="Fechar menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent
              currentPath={currentPath}
              currentUrl={currentUrl}
              email={email}
              name={name}
              avatarUrl={avatarUrl}
              onLogout={handleLogout}
              onOpenProfile={() => { setMobileSidebarOpen(false); navigate("/configuracoes"); }}
              onBillingReminderClick={() => { setMobileSidebarOpen(false); setBillingReminderOpen(true); }}
              onNavigate={() => setMobileSidebarOpen(false)}
            />
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border-default bg-bg-card px-4 py-3 lg:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-bg-muted text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
            aria-label="Abrir menu lateral"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="truncate font-sans text-lg font-bold text-text-primary">
            {title}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <MobileNotificationBell onBillingReminderClick={() => setBillingReminderOpen(true)} />
          <button
            onClick={() => navigate("/configuracoes")}
            className="rounded-full transition hover:ring-2 hover:ring-accent-gold/50 focus:outline-none"
            aria-label="Abrir configurações"
          >
            <Avatar email={email} name={name} avatarUrl={avatarUrl} />
          </button>
        </div>
      </header>

      <main
        className={cn(
          "min-h-screen bg-bg-base p-5 pb-24 transition-[margin] duration-200 lg:pb-5",
          desktopSidebarCollapsed ? "lg:ml-20" : "lg:ml-64",
        )}
      >
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 z-40 grid w-full grid-cols-5 border-t border-border-default bg-bg-card px-3 pb-3 pt-2 lg:hidden">
        {mobileNavigation.slice(0, 2).map(({ to, label, icon: Icon }) => {
          const active = currentPath === to;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center gap-1 text-xs",
                active ? "text-accent-gold" : "text-text-muted",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}

        <button
          onClick={() => setAddModalOpen(true)}
          className="-mt-6 mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent-gold text-black shadow-lg shadow-accent-gold/20"
          aria-label="Adicionar transação"
        >
          <Plus className="h-6 w-6" />
        </button>

        {mobileNavigation.slice(2).map(({ to, label, icon: Icon }) => {
          const active = currentPath === to;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-col items-center gap-1 text-xs",
                active ? "text-accent-gold" : "text-text-muted",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>

      {addModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 p-4 sm:place-items-center">
          <div className="w-full max-w-sm rounded-2xl border border-border-default bg-bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-sans text-lg font-bold">Nova movimentação</h2>
              <button
                onClick={() => setAddModalOpen(false)}
                className="rounded-lg px-2 py-1 text-text-secondary hover:bg-bg-overlay hover:text-text-primary"
              >
                Fechar
              </button>
            </div>
            <div className="grid gap-3">
              <button
                onClick={() => openTx("EXPENSE")}
                className="flex items-center gap-3 rounded-xl bg-bg-muted p-4 text-left hover:bg-bg-overlay"
              >
                <ArrowLeftRight className="h-5 w-5 text-accent-gold" />
                <span className="font-semibold">Nova Movimentação</span>
              </button>
              <button
                onClick={() => { setAddModalOpen(false); navigate("/contas?action=create"); }}
                className="flex items-center gap-3 rounded-xl bg-bg-muted p-4 text-left hover:bg-bg-overlay"
              >
                <Clock className="h-5 w-5 text-accent-yellow" />
                <span className="font-semibold">Nova Conta</span>
              </button>
              <button
                onClick={() => { setAddModalOpen(false); navigate("/goals?action=create"); }}
                className="flex items-center gap-3 rounded-xl bg-bg-muted p-4 text-left hover:bg-bg-overlay"
              >
                <Target className="h-5 w-5 text-accent-gold" />
                <span className="font-semibold">Nova Meta</span>
              </button>
              <button
                onClick={() => { setAddModalOpen(false); navigate("/carteiras?action=create"); }}
                className="flex items-center gap-3 rounded-xl bg-bg-muted p-4 text-left hover:bg-bg-overlay"
              >
                <Landmark className="h-5 w-5 text-text-secondary" />
                <span className="font-semibold">Nova Carteira</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <Suspense fallback={null}>
        <TransactionModal open={txOpen} onClose={() => setTxOpen(false)} defaultTab={txTab} />
      </Suspense>

      <Suspense fallback={null}>
        <WhatsNewModal open={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />
      </Suspense>

      <WebAuthnSuggestionModal
        open={webAuthnSuggestion.open && !whatsNewOpen}
        isForm1={webAuthnSuggestion.isForm1}
        onDismiss={webAuthnSuggestion.dismiss}
        onRegistered={webAuthnSuggestion.markRegistered}
      />

      <PixBillingReminderModal open={billingReminderOpen} onClose={() => setBillingReminderOpen(false)} />
    </div>
  </TransactionModalContext.Provider>
  );
}
