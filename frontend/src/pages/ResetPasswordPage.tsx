import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import { CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router-dom";
import { z } from "zod";

import { AuthCard } from "../components/AuthCard";
import { Field } from "../components/Field";
import { SubmitButton } from "../components/SubmitButton";
import { api } from "../lib/api";

const resetSchema = z
  .object({
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

type ResetForm = z.infer<typeof resetSchema>;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState("");
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: ResetForm) {
    setApiError("");

    if (!token) {
      setApiError("Token de redefinição ausente.");
      return;
    }

    try {
      await api.post("/api/auth/reset-password", {
        token,
        password: values.password,
      });
      setSuccess(true);
    } catch (error) {
      const message =
        isAxiosError(error) && typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : "Não foi possível redefinir sua senha.";
      setApiError(message);
    }
  }

  if (success) {
    return (
      <AuthCard
        title="Senha redefinida"
        footer={
          <Link to="/login" className="font-semibold text-accent-lime hover:underline">
            Entrar
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="h-12 w-12 text-accent-lime" />
          <p className="text-sm text-text-secondary">Agora você pode acessar sua conta.</p>
        </div>
      </AuthCard>
    );
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

        <SubmitButton loading={isSubmitting}>Redefinir senha</SubmitButton>
      </form>
    </AuthCard>
  );
}
