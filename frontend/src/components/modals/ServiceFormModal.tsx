import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { Check, Loader2, Wrench } from "lucide-react";
import { z } from "zod";

import { api } from "../../lib/api";
import { getApiErrorMessages, setFieldErrorsFromApi } from "../../lib/errors";
import { CurrencyInput } from "../ui/CurrencyInput";
import { ModalShell } from "./ModalShell";
import { useToast } from "../ui/Toast";
import { cn } from "../../lib/utils";
import type { Service } from "../../types/api";

// Verde = default (ganho de serviço); demais opções pra diferenciar serviços no
// relatório de ganhos por categoria sem depender de cores repetidas.
const DEFAULT_SERVICE_COLOR = "#22C55E";
const COLOR_OPTIONS: { value: string; label: string }[] = [
  { value: "#22C55E", label: "Verde" },
  { value: "#0EA5E9", label: "Azul claro" },
  { value: "#3B82F6", label: "Azul" },
  { value: "#8B5CF6", label: "Roxo" },
  { value: "#EC4899", label: "Rosa" },
  { value: "#F59E0B", label: "Âmbar" },
  { value: "#F97316", label: "Laranja" },
  { value: "#EF4444", label: "Vermelho" },
  { value: "#14B8A6", label: "Verde-água" },
  { value: "#A3E635", label: "Lima" },
];

const serviceSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do serviço.").max(150),
  type: z.string().max(100).optional(),
  defaultValue: z.coerce.number().min(0.01, "Informe um valor maior que zero."),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Escolha uma cor válida."),
});

type ServiceFormInput = z.input<typeof serviceSchema>;
type ServiceFormValues = z.output<typeof serviceSchema>;

export function ServiceFormModal({
  open,
  service,
  onClose,
  onSaved,
}: {
  open: boolean;
  service: Service | null;
  onClose: () => void;
  onSaved?: (service: Service) => void;
}) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const isEditing = Boolean(service);
  const form = useForm<ServiceFormInput, unknown, ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: { name: "", type: "", defaultValue: 0, color: DEFAULT_SERVICE_COLOR },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: service?.name ?? "",
      type: service?.type ?? "",
      defaultValue: service?.defaultValue ?? 0,
      color: service?.color ?? DEFAULT_SERVICE_COLOR,
    });
  }, [open, service, form]);

  const mutation = useMutation({
    mutationFn: async (values: ServiceFormValues) => {
      const payload = {
        name: values.name.trim(),
        type: values.type?.trim() || undefined,
        defaultValue: values.defaultValue,
        color: values.color,
      };
      if (service) {
        const { data } = await api.patch<Service>(`/api/services/${service._id}`, payload);
        return data;
      }
      const { data } = await api.post<Service>("/api/services", payload);
      return data;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      addToast(isEditing ? "Serviço atualizado com sucesso." : "Serviço criado com sucesso.", "success");
      onSaved?.(saved);
      onClose();
    },
    onError: (error) => {
      setFieldErrorsFromApi(error, form.setError, ["name", "type", "defaultValue", "color"]);
    },
  });

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={isEditing ? "Editar Serviço" : "Novo Serviço"}
      icon={<Wrench className="h-6 w-6 text-accent-lime" />}
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="flex-1 rounded-xl border border-bg-muted bg-transparent px-5 py-3 text-sm font-bold text-white transition hover:bg-bg-overlay disabled:cursor-not-allowed disabled:opacity-70"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="service-form"
            disabled={mutation.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-lime px-5 py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEditing ? "Salvar Alterações" : "Criar Serviço"}
          </button>
        </div>
      }
    >
      <form id="service-form" className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <label className="block">
          <span className="mb-1 block text-sm text-text-secondary">Nome do serviço</span>
          <input
            type="text"
            maxLength={150}
            placeholder="Ex.: Lavagem Completa"
            {...form.register("name")}
            className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-lime"
          />
          {form.formState.errors.name?.message && (
            <p className="mt-1 text-xs text-accent-red">{form.formState.errors.name.message}</p>
          )}
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-text-secondary">Tipo (opcional)</span>
          <input
            type="text"
            maxLength={100}
            placeholder="Ex.: Lavagem, Polimento, Estética interna"
            {...form.register("type")}
            className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-lime"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-text-secondary">Valor padrão</span>
          <Controller
            control={form.control}
            name="defaultValue"
            render={({ field }) => (
              <CurrencyInput
                value={Number(field.value ?? 0)}
                onChange={field.onChange}
                onBlur={field.onBlur}
                className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-lime"
              />
            )}
          />
          {form.formState.errors.defaultValue?.message && (
            <p className="mt-1 text-xs text-accent-red">{form.formState.errors.defaultValue.message}</p>
          )}
        </label>

        <div>
          <span className="mb-2 block text-sm text-text-secondary">
            Cor no relatório de ganhos
          </span>
          <Controller
            control={form.control}
            name="color"
            render={({ field }) => (
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((option) => {
                  const active = field.value === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      title={option.label}
                      onClick={() => field.onChange(option.value)}
                      style={{ backgroundColor: option.value }}
                      className={cn(
                        "grid h-9 w-9 place-items-center rounded-full transition",
                        active ? "ring-2 ring-white ring-offset-2 ring-offset-bg-card" : "hover:brightness-110",
                      )}
                      aria-label={option.label}
                      aria-pressed={active}
                    >
                      {active && <Check className="h-4 w-4 text-white drop-shadow" />}
                    </button>
                  );
                })}
              </div>
            )}
          />
          {form.formState.errors.color?.message && (
            <p className="mt-1 text-xs text-accent-red">{form.formState.errors.color.message}</p>
          )}
        </div>

        {mutation.isError && (
          <div className="rounded-xl bg-accent-red/10 p-3 text-sm text-accent-red">
            {getApiErrorMessages(mutation.error, "Não foi possível salvar o serviço.").map((m) => (
              <p key={m}>{m}</p>
            ))}
          </div>
        )}
      </form>
    </ModalShell>
  );
}
