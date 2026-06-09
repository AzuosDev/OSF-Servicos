import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import { Eye, EyeOff, Lock } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";

import { AuthCard } from "../components/AuthCard";
import { Field } from "../components/Field";
import { SubmitButton } from "../components/SubmitButton";
import { api } from "../lib/api";
import { setTokens } from "../lib/auth";
import type { AuthTokens } from "../types/api";

const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, "A senha deve ter no mínimo 8 caracteres")
      .regex(/[A-Z]/, "A senha deve conter ao menos 1 letra maiúscula")
      .regex(/[0-9]/, "A senha deve conter ao menos 1 número"),
  });

type ResetForm = z.infer<typeof resetSchema>;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "" },
  });

  async function onSubmit(values: ResetForm) {
    setApiError("");

    if (!token) {
      setApiError("Token de redefinição ausente.");
      return;
    }

    try {
      const { data } = await api.post<AuthTokens>("/api/auth/reset-password", {
        token,
        password: values.password,
      });

      if (!data?.accessToken || !data?.refreshToken) {
        throw new Error("Resposta inválida do servidor");
      }

      setTokens(data.accessToken, data.refreshToken);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      const message =
        isAxiosError(error) && typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : "Não foi possível redefinir sua senha.";
      setApiError(message);
    }
  }

  return (
    <AuthCard title="Nova senha" subtitle="Escolha uma senha forte para sua conta">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field
          {...register("password")}
          type={showPassword ? "text" : "password"}
          placeholder="Nova senha"
          autoComplete="new-password"
          icon={<Lock className="h-4 w-4" />}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="text-text-secondary hover:text-text-primary"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
          error={errors.password?.message}
        />

        {apiError && (
          <div className="rounded-icon border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-sm text-accent-red">
            {apiError}
          </div>
        )}

        <SubmitButton loading={isSubmitting}>Redefinir senha</SubmitButton>
      </form>
    </AuthCard>
  );
}
