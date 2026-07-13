import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";

import { AppLayout } from "./components/layout/AppLayout";
import { LandingPage } from "./pages/LandingPage";
import { ToastProvider } from "./components/ui/Toast";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { getAccessToken, hasRefreshToken, refreshAccessToken } from "./lib/auth";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react"

const BudgetPage = lazy(() => import("./pages/BudgetPage").then((m) => ({ default: m.BudgetPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const ExpensesPage = lazy(() => import("./pages/ExpensesPage").then((m) => ({ default: m.ExpensesPage })));
const GoalsPage = lazy(() => import("./pages/GoalsPage").then((m) => ({ default: m.GoalsPage })));
const InsightsPage = lazy(() => import("./pages/InsightsPage").then((m) => ({ default: m.InsightsPage })));
const ContasPage = lazy(() => import("./pages/ContasPage").then((m) => ({ default: m.ContasPage })));
const TransactionsPage = lazy(() => import("./pages/TransactionsPage").then((m) => ({ default: m.TransactionsPage })));
const LoginPage = lazy(() => import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("./pages/RegisterPage").then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage").then((m) => ({ default: m.VerifyEmailPage })));
const WalletPage = lazy(() => import("./pages/WalletPage").then((m) => ({ default: m.WalletPage })));
const WalletsPage = lazy(() => import("./pages/WalletsPage").then((m) => ({ default: m.WalletsPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-bg-overlay border-t-accent-lime" />
    </div>
  );
}

function PrivateRoute() {
  const location = useLocation();
  const { isLocked } = useAuth();

  if (isLocked || !getAccessToken()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

function resolveAuthRedirect(hasToken: string | null, isLocked: boolean): string | null {
  if (hasToken && isLocked) {
    return "/login";
  }

  if (hasToken) {
    return "/dashboard";
  }

  return null;
}

function RootRoute() {
  const { isLocked } = useAuth();
  const redirect = resolveAuthRedirect(getAccessToken(), isLocked);

  return <Navigate to={redirect ?? "/landing"} replace />;
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
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
        <AppBoot>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<RootRoute />} />
              <Route path="/landing" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              <Route element={<PrivateRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/insights" element={<InsightsPage />} />
                  <Route path="/expenses" element={<ExpensesPage />} />
                  <Route path="/transactions" element={<TransactionsPage />} />
                  <Route path="/budget" element={<BudgetPage />} />
                  <Route path="/goals" element={<GoalsPage />} />
                  <Route path="/contas" element={<ContasPage />} />
                  <Route path="/pending" element={<Navigate to="/contas" replace />} />
                  <Route path="/carteiras" element={<WalletsPage />} />
                  <Route path="/carteiras/:id" element={<WalletPage />} />
                  <Route path="/configuracoes" element={<SettingsPage />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          <SpeedInsights />
          <Analytics />
        </AppBoot>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
    
  );
}
