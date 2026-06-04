import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import { AuthCard } from "../components/AuthCard";
import { Field } from "../components/Field";
import { SubmitButton } from "../components/SubmitButton";
import { api } from "../lib/api";
import { setTokens } from "../lib/auth";
import { getApiErrorMessages } from "../lib/errors";
import type { AuthTokens } from "../types/api";

const loginSchema = z.object({
  email: z.string().trim().email("Informe um email válido"),
  password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres"),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [apiErrors, setApiErrors] = useState<string[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginForm) {
    setApiErrors([]);

    try {
      const { data } = await api.post<AuthTokens>("/api/auth/login", values);

      if (!data?.accessToken || !data?.refreshToken) {
        throw new Error("Resposta inválida do servidor");
      }

      setTokens(data.accessToken, data.refreshToken);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setApiErrors(getApiErrorMessages(error, "Nao foi possivel entrar. Verifique suas credenciais."));
    }
  }

  return (
    <AuthCard
      title="Bem-vindo de volta"
      subtitle="Gerencie suas finanças com inteligência"
      footer={
        <>
          Não tem conta?{" "}
          <Link to="/register" className="font-semibold text-accent-lime hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field
          {...register("email")}
          type="email"
          placeholder="seu@email.com"
          autoComplete="email"
          icon={<Mail className="h-4 w-4" />}
          error={errors.email?.message}
        />

        <Field
          {...register("password")}
          type={showPassword ? "text" : "password"}
          placeholder="Sua senha"
          autoComplete="current-password"
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

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-xs font-medium text-accent-lime hover:underline">
            Esqueci minha senha
          </Link>
        </div>

        {apiErrors.length > 0 && (
          <div className="rounded-icon border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-sm text-accent-red">
            {apiErrors.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        )}

        <SubmitButton loading={isSubmitting}>Entrar</SubmitButton>
      </form>
    </AuthCard>
  );
}
