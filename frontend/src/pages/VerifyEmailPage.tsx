import { isAxiosError } from "axios";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { AuthCard } from "../components/AuthCard";
import { api } from "../lib/api";

type VerifyState =
  | { status: "loading"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<VerifyState>({
    status: "loading",
    message: "Verificando seu email...",
  });

  useEffect(() => {
    if (!token) {
      setState({ status: "error", message: "Token de verificação ausente." });
      return;
    }

    api
      .get("/api/auth/verify-email", { params: { token } })
      .then(() => {
        setState({ status: "success", message: "Seu email foi verificado com sucesso." });
      })
      .catch((error) => {
        const message =
          isAxiosError(error) && typeof error.response?.data?.message === "string"
            ? error.response.data.message
            : "Não foi possível verificar este email. O token pode ter expirado.";
        setState({ status: "error", message });
      });
  }, [token]);

  return (
    <AuthCard
      title="Verificação de email"
      footer={
        <Link to="/login" className="font-semibold text-accent-lime hover:underline">
          Ir para login
        </Link>
      }
    >
      <div className="flex flex-col items-center gap-3 text-center">
        {state.status === "loading" && <Loader2 className="h-12 w-12 animate-spin text-accent-lime" />}
        {state.status === "success" && <CheckCircle2 className="h-12 w-12 text-accent-lime" />}
        {state.status === "error" && <XCircle className="h-12 w-12 text-accent-red" />}
        <p className="text-sm text-text-secondary">{state.message}</p>
      </div>
    </AuthCard>
  );
}
