import { useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";

import { AppLayout } from "./components/layout/AppLayout";
import { ToastProvider } from "./components/ui/Toast";
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
    <ToastProvider>
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
    </ToastProvider>
  );
}
