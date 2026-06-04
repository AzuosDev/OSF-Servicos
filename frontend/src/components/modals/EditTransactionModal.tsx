import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { z } from "zod";

import { api } from "../../lib/api";
import { getApiErrorMessages, setFieldErrorsFromApi } from "../../lib/errors";
import { buildTransactionPayload, dateInputValue } from "../../lib/finance";
import type { Transaction } from "../../types/finance";
import type { Transaction as ApiTransaction } from "../../types/api";
import {
  AmountField,
  CategoryField,
  DateAndDescriptionFields,
  type TransactionFormValues,
  useCategories,
} from "./TransactionFormFields";
import { ModalShell } from "./ModalShell";

const baseSchema = z.object({
  amount: z.number().positive("Informe um valor maior que zero."),
  categoryId: z.string().default(""),
  date: z.string().min(1, "Informe a data."),
  description: z.string().max(500, "Use até 500 caracteres.").optional(),
});

export function EditTransactionModal({
  transaction,
  onClose,
}: {
  transaction: Transaction | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const categoriesQuery = useCategories();
  const isExpense = transaction?.type === "EXPENSE";
  const schema = baseSchema.refine((values) => !isExpense || Boolean(values.categoryId), {
    message: "Escolha uma categoria.",
    path: ["categoryId"],
  });
  const form = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: 0,
      categoryId: "",
      date: new Date().toISOString().slice(0, 10),
      description: "",
    },
  });

  useEffect(() => {
    if (transaction) {
      form.reset({
        amount: transaction.amount,
        categoryId: transaction.categoryId ?? transaction.category?.id ?? "",
        date: dateInputValue(transaction.date),
        description: transaction.description ?? "",
      });
    }
  }, [form, transaction]);

  const mutation = useMutation({
    mutationFn: async (values: any) => {
      if (!transaction) {
        return;
      }

      await api.patch<ApiTransaction>(
        `/api/transactions/${transaction.id}`,
        buildTransactionPayload({ ...values, type: transaction.type }),
      );
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-expenses"] }),
      ]);
      onClose();
    },
    onError: (error) => {
      setFieldErrorsFromApi(error, form.setError, ["amount", "categoryId", "date", "description"]);
    },
  });

  return (
    <ModalShell
      open={Boolean(transaction)}
      onClose={onClose}
      title={isExpense ? "Editar Gasto" : "Editar Ganho"}
      icon={
        isExpense ? (
          <TrendingDown className="h-6 w-6 text-accent-red" />
        ) : (
          <TrendingUp className="h-6 w-6 text-accent-lime" />
        )
      }
    >
      <form className="space-y-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <AmountField register={form.register} errors={form.formState.errors} />

        {isExpense && (
          <Controller
            control={form.control}
            name="categoryId"
            render={({ field, fieldState }) => (
              <CategoryField
                categories={categoriesQuery.data ?? []}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message}
                loading={categoriesQuery.isLoading}
              />
            )}
          />
        )}

        <DateAndDescriptionFields
          register={form.register}
          watch={form.watch}
          errors={form.formState.errors}
        />

        {mutation.isError && (
          <div className="rounded-xl bg-accent-red/10 p-3 text-sm text-accent-red">
            {getApiErrorMessages(mutation.error, "Nao foi possivel atualizar a transacao.").map((message) => (
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
          Salvar Alterações
        </button>
      </form>
    </ModalShell>
  );
}

