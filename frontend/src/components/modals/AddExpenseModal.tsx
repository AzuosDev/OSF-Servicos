import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { Loader2, TrendingDown } from "lucide-react";
import { z } from "zod";

import { api } from "../../lib/api";
import { buildTransactionPayload } from "../../lib/finance";
import {
  AmountField,
  CategoryField,
  DateAndDescriptionFields,
  type TransactionFormValues,
  useCategories,
} from "./TransactionFormFields";
import { ModalShell } from "./ModalShell";

const schema = z.object({
  amount: z.number().positive("Informe um valor maior que zero."),
  categoryId: z.string().min(1, "Escolha uma categoria."),
  date: z.string().min(1, "Informe a data."),
  description: z.string().max(500, "Use até 500 caracteres.").optional(),
});


function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function AddExpenseModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const categoriesQuery = useCategories();
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
      await api.post(
        "/api/transactions",
        buildTransactionPayload({ ...values, type: "EXPENSE" }),
      );
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["expenses"] }),
      ]);
      onClose();
    },
  });

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Novo Gasto"
      icon={<TrendingDown className="h-6 w-6 text-accent-red" />}
    >
      <form
        className="space-y-5"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      >
        <AmountField register={form.register} errors={form.formState.errors} />

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

        <DateAndDescriptionFields
          register={form.register}
          watch={form.watch}
          errors={form.formState.errors}
        />

        {mutation.isError && (
          <p className="rounded-xl bg-accent-red/10 p-3 text-sm text-accent-red">
            Não foi possível salvar o gasto.
          </p>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-lime px-5 py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar Gasto
        </button>
      </form>
    </ModalShell>
  );
}

