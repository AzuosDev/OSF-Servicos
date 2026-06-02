import { useEffect, useState } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { BarChart3, CircleDollarSign, Clock, CreditCard, Flag, LayoutDashboard, Target } from "lucide-react";

import { getAccessToken, hasRefreshToken, refreshAccessToken } from "./lib/auth";
import { BudgetPage } from "./pages/BudgetPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ExpensesPage } from "./pages/ExpensesPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { GoalsPage } from "./pages/GoalsPage";
import { LoginPage } from "./pages/LoginPage";
import { PendingPage } from "./pages/PendingPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";

function PrivateRoute() {
  const location = useLocation();

  if (!getAccessToken()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

function RootRedirect() {
  return <Navigate to={getAccessToken() ? "/dashboard" : "/login"} replace />;
}

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/expenses", label: "Gastos", icon: CircleDollarSign },
  { to: "/transactions", label: "Transações", icon: CreditCard },
  { to: "/budget", label: "Orçamento", icon: BarChart3 },
  { to: "/goals", label: "Metas", icon: Target },
  { to: "/pending", label: "Pendentes", icon: Clock },
];

function AppLayout() {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-bg-overlay bg-bg-card p-5 md:block">
        <Link to="/dashboard" className="flex items-center gap-2 font-sans text-xl font-bold">
          <Flag className="h-6 w-6 text-accent-lime" />
          ContaCerta
        </Link>
        <nav className="mt-8 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-icon px-3 py-2 text-sm text-text-secondary hover:bg-bg-muted hover:text-text-primary"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="px-4 py-6 md:ml-64 md:px-8">
        <Outlet />
      </main>
    </div>
  );
}

function AppBoot({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!hasRefreshToken());

  useEffect(() => {
    if (!hasRefreshToken()) {
      return;
    }

    refreshAccessToken().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-base">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-bg-overlay border-t-accent-lime" />
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AppBoot>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route element={<PrivateRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/budget" element={<BudgetPage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/pending" element={<PendingPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppBoot>
  );
}
