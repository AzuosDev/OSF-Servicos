import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Loader2, TrendingUp } from "lucide-react";
import { z } from "zod";

import { api } from "../../lib/api";
import { getApiErrorMessages, setFieldErrorsFromApi } from "../../lib/errors";
import { buildTransactionPayload } from "../../lib/finance";
import {
  AmountField,
  DateAndDescriptionFields,
  type TransactionFormValues,
} from "./TransactionFormFields";
import { ModalShell } from "./ModalShell";
import type { Transaction as ApiTransaction } from "../../types/api";

const schema = z.object({
  amount: z.number().positive("Informe um valor maior que zero."),
  categoryId: z.string().default(""),
  date: z.string().min(1, "Informe a data."),
  description: z.string().max(500, "Use até 500 caracteres.").optional(),
});

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function AddIncomeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: 0,
      categoryId: "",
      date: todayInputValue(),
      description: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        amount: 0,
        categoryId: "",
        date: todayInputValue(),
        description: "",
      });
    }
  }, [form, open]);

  const mutation = useMutation({
    mutationFn: async (values: any) => {
      await api.post<ApiTransaction>(
        "/api/transactions",
        buildTransactionPayload({ ...values, type: "INCOME" }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-expenses"] });
      onClose();
    },
    onError: (error) => {
      setFieldErrorsFromApi(error, form.setError, ["amount", "date", "description"]);
    },
  });

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Novo Ganho"
      icon={<TrendingUp className="h-6 w-6 text-accent-lime" />}
    >
      <form
        className="space-y-5"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      >
        <AmountField register={form.register} errors={form.formState.errors} />
        <DateAndDescriptionFields
          register={form.register}
          watch={form.watch}
          errors={form.formState.errors}
        />

        {mutation.isError && (
          <div className="rounded-xl bg-accent-red/10 p-3 text-sm text-accent-red">
            {getApiErrorMessages(mutation.error, "Nao foi possivel salvar o ganho.").map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-lime px-5 py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar Ganho
        </button>
      </form>
    </ModalShell>
  );
}

