import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Loader2, User } from "lucide-react";
import { z } from "zod";

import { api } from "../../lib/api";
import { getApiErrorMessages, setFieldErrorsFromApi } from "../../lib/errors";
import { ModalShell } from "./ModalShell";
import type { Client } from "../../types/api";

const clientSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do cliente.").max(150),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().max(150).email("Informe um email válido.").optional().or(z.literal("")),
  address: z.string().trim().min(1, "Informe o endereço para o cálculo de deslocamento.").max(300),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(2).optional(),
  notes: z.string().trim().max(500).optional(),
});

type ClientFormInput = z.input<typeof clientSchema>;
type ClientFormValues = z.output<typeof clientSchema>;

export function ClientFormModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (client: Client) => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<ClientFormInput, unknown, ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: { name: "", phone: "", email: "", address: "", city: "", state: "", notes: "" },
  });

  const mutation = useMutation({
    mutationFn: async (values: ClientFormValues) => {
      const payload = {
        name: values.name.trim(),
        phone: values.phone?.trim() || undefined,
        email: values.email?.trim() || undefined,
        address: values.address.trim(),
        city: values.city?.trim() || undefined,
        state: values.state?.trim() || undefined,
        notes: values.notes?.trim() || undefined,
      };
      const { data } = await api.post<Client>("/api/orcamentos/clients", payload);
      return data;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["orcamentos-clients"] });
      form.reset();
      onSaved(saved);
    },
    onError: (error) => {
      setFieldErrorsFromApi(error, form.setError, ["name", "phone", "email", "address", "city", "state", "notes"]);
    },
  });

  if (!open) {
    return null;
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Novo cliente"
      icon={<User className="h-6 w-6 text-accent-gold" />}
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
            form="client-form"
            disabled={mutation.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-gold px-5 py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar cliente
          </button>
        </div>
      }
    >
      <form
        id="client-form"
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      >
        <label className="block">
          <span className="mb-1 block text-sm text-text-secondary">Nome</span>
          <input
            type="text"
            maxLength={150}
            placeholder="Nome completo ou razão social"
            {...form.register("name")}
            className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold"
          />
          {form.formState.errors.name?.message && (
            <p className="mt-1 text-xs text-accent-red">{form.formState.errors.name.message}</p>
          )}
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-text-secondary">Endereço (Pode ser apenas a Cidade)</span>
          <input
            type="text"
            maxLength={300}
            placeholder="Usado para calcular o deslocamento"
            {...form.register("address")}
            className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold"
          />
          {form.formState.errors.address?.message && (
            <p className="mt-1 text-xs text-accent-red">{form.formState.errors.address.message}</p>
          )}
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm text-text-secondary">Cidade (opcional)</span>
            <input
              type="text"
              maxLength={100}
              {...form.register("city")}
              className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-text-secondary">UF (opcional)</span>
            <input
              type="text"
              maxLength={2}
              placeholder="CE"
              {...form.register("state")}
              className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm text-text-secondary">Telefone (opcional)</span>
          <input
            type="tel"
            maxLength={30}
            placeholder="(11) 99999-9999"
            {...form.register("phone")}
            className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-text-secondary">Email (opcional)</span>
          <input
            type="email"
            maxLength={150}
            {...form.register("email")}
            className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold"
          />
          {form.formState.errors.email?.message && (
            <p className="mt-1 text-xs text-accent-red">{form.formState.errors.email.message}</p>
          )}
        </label>

        {mutation.isError && (
          <div className="rounded-xl bg-accent-red/10 p-3 text-sm text-accent-red">
            {getApiErrorMessages(mutation.error, "Não foi possível criar o cliente.").map((m) => (
              <p key={m}>{m}</p>
            ))}
          </div>
        )}
      </form>
    </ModalShell>
  );
}
