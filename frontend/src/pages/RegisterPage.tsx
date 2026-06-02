import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import { CheckCircle2, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";

import { AuthCard } from "../components/AuthCard";
import { Field } from "../components/Field";
import { SubmitButton } from "../components/SubmitButton";
import { api } from "../lib/api";

const registerSchema = z
  .object({
    email: z.string().trim().email("Informe um email válido"),
    password: z
      .string()
      .min(8, "A senha deve ter no mínimo 8 caracteres")
      .regex(/[A-Z]/, "A senha deve conter ao menos 1 letra maiúscula")
      .regex(/[0-9]/, "A senha deve conter ao menos 1 número"),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não coincidem",
  });

type RegisterForm = z.infer<typeof registerSchema>;

function getApiError(error: unknown, fallback: string) {
  if (isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string") {
      return message;
    }
  }

  return fallback;
}

export function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState("");
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: RegisterForm) {
    setApiError("");

    try {
      await api.post("/api/auth/register", {
        email: values.email,
        password: values.password,
      });
      setSuccess(true);
    } catch (error) {
      setApiError(getApiError(error, "Não foi possível criar sua conta."));
    }
  }

  if (success) {
    return (
      <AuthCard
        title="Cadastro iniciado"
        footer={
          <Link to="/login" className="font-semibold text-accent-lime hover:underline">
            Voltar para login
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="h-12 w-12 text-accent-lime" />
          <p className="text-sm text-text-secondary">
            Verifique seu email para confirmar o cadastro
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Criar conta"
      subtitle="Comece a organizar suas finanças"
      footer={
        <>
          Já tem conta?{" "}
          <Link to="/login" className="font-semibold text-accent-lime hover:underline">
            Entrar
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
          placeholder="Senha"
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

        <Field
          {...register("confirmPassword")}
          type={showPassword ? "text" : "password"}
          placeholder="Confirmar senha"
          autoComplete="new-password"
          icon={<Lock className="h-4 w-4" />}
          error={errors.confirmPassword?.message}
        />

        {apiError && (
          <div className="rounded-icon border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-sm text-accent-red">
            {apiError}
          </div>
        )}

        <SubmitButton loading={isSubmitting}>Criar conta</SubmitButton>
      </form>
    </AuthCard>
  );
}
