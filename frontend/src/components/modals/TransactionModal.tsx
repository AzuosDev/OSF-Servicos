import { useCallback, useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { ArrowLeftRight, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { z } from "zod";
import { Link } from "react-router-dom";

import { api } from "../../lib/api";
import { getApiErrorMessages, setFieldErrorsFromApi } from "../../lib/errors";
import { buildTransactionPayload, dateInputValue, localDateString } from "../../lib/finance";
import type { Transaction } from "../../types/finance";
import {
  AmountField,
  CategoryField,
  DateAndDescriptionFields,
  GoalField,
  WalletField,
  useCategories,
  useIncomeCategories,
  useOpenGoals,
  useWallets,
} from "./TransactionFormFields";
import { ModalShell } from "./ModalShell";
import { cn } from "../../lib/utils";

type Tab = "INCOME" | "EXPENSE" | "TRANSFER";

function todayInputValue() {
  return localDateString();
}

const defaultValues = {
  amount: 0,
  categoryId: "",
  carteiraId: "",
  carteiraOrigemId: "",
  carteiraDestinoId: "",
  goalId: "",
  date: todayInputValue(),
  description: "",
};

const incomeSchema = z.object({
  amount: z.number().positive("Informe um valor maior que zero."),
  categoryId: z.string().optional().default(""),
  carteiraId: z.string().min(1, "Selecione uma carteira."),
  date: z.string().min(1, "Informe a data."),
  description: z.string().max(500).optional(),
  carteiraOrigemId: z.string().optional().default(""),
  carteiraDestinoId: z.string().optional().default(""),
  goalId: z.string().optional().default(""),
});

const expenseSchema = z.object({
  amount: z.number().positive("Informe um valor maior que zero."),
  categoryId: z.string().min(1, "Escolha uma categoria."),
  carteiraId: z.string().min(1, "Selecione uma carteira."),
  date: z.string().min(1, "Informe a data."),
  description: z.string().max(500).optional(),
  carteiraOrigemId: z.string().optional().default(""),
  carteiraDestinoId: z.string().optional().default(""),
});

const transferSchema = z
  .object({
    amount: z.number().positive("Informe um valor maior que zero."),
    categoryId: z.string().optional().default(""),
    carteiraId: z.string().optional().default(""),
    carteiraOrigemId: z.string().min(1, "Selecione a carteira de origem."),
    carteiraDestinoId: z.string().min(1, "Selecione a carteira de destino."),
    date: z.string().min(1, "Informe a data."),
    description: z.string().max(500).optional(),
  })
  .refine((d) => d.carteiraOrigemId !== d.carteiraDestinoId, {
    message: "As carteiras de origem e destino devem ser diferentes.",
    path: ["carteiraDestinoId"],
  });

const tabConfig = {
  INCOME: {
    label: "Ganho",
    icon: TrendingUp,
    activeCls: "bg-green-600 text-white",
    iconCls: "text-accent-gold",
    submitLabel: "Salvar Ganho",
    submitCls: "bg-accent-gold text-black",
  },
  EXPENSE: {
    label: "Gasto",
    icon: TrendingDown,
    activeCls: "bg-red-600 text-white",
    iconCls: "text-accent-red",
    submitLabel: "Salvar Gasto",
    submitCls: "bg-accent-gold text-black",
  },
  TRANSFER: {
    label: "Transferência",
    icon: ArrowLeftRight,
    activeCls: "bg-blue-600 text-white",
    iconCls: "text-blue-400",
    submitLabel: "Transferir",
    submitCls: "bg-blue-600 text-white",
  },
} as const;

const selectCls =
  "w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none transition focus:border-accent-gold";

export function TransactionModal({
  open,
  onClose,
  defaultTab = "EXPENSE",
  transaction,
}: {
  open: boolean;
  onClose: () => void;
  defaultTab?: Tab;
  transaction?: Transaction | null;
}) {
  const isEditing = Boolean(transaction);
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
  const activeTabRef = useRef<Tab>(activeTab);
  activeTabRef.current = activeTab;

  const queryClient = useQueryClient();
  const expenseCatsQuery = useCategories();
  const incomeCatsQuery = useIncomeCategories();
  const walletsQuery = useWallets();
  const wallets = walletsQuery.data ?? [];
  const openGoalsQuery = useOpenGoals();
  const openGoals = openGoalsQuery.data ?? [];
  const hasEnoughWallets = wallets.length >= 2;
  const hasWallets = wallets.length > 0;

  const dynamicResolver = useCallback(
    (values: typeof defaultValues, ctx: unknown, opts: unknown) => {
      const schema =
        activeTabRef.current === "TRANSFER"
          ? transferSchema
          : activeTabRef.current === "EXPENSE"
            ? expenseSchema
            : incomeSchema;
      return (zodResolver(schema) as (v: typeof defaultValues, c: unknown, o: unknown) => Promise<unknown>)(
        values,
        ctx,
        opts,
      );
    },
    [],
  );

  const form = useForm<typeof defaultValues>({
    resolver: dynamicResolver as never,
    defaultValues,
  });

  useEffect(() => {
    if (!open) return;
    if (transaction) {
      const tab = transaction.type;
      setActiveTab(tab);
      form.reset({
        amount: transaction.amount,
        categoryId: transaction.categoryId ?? transaction.category?.id ?? "",
        carteiraId: tab === "TRANSFER" ? "" : (transaction.carteiraId ?? ""),
        carteiraOrigemId: tab === "TRANSFER" ? (transaction.carteiraId ?? "") : "",
        carteiraDestinoId: tab === "TRANSFER" ? (transaction.carteiraDestinoId ?? "") : "",
        goalId: "",
        date: dateInputValue(transaction.date),
        description: transaction.description ?? "",
      });
    } else {
      setActiveTab(defaultTab);
      form.reset({ ...defaultValues });
    }
  }, [open, defaultTab, transaction, form]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    form.clearErrors();
  };

  const mutation = useMutation({
    mutationFn: async (values: typeof defaultValues) => {
      const tab = activeTabRef.current;
      if (transaction) {
        if (tab === "TRANSFER") {
          await api.patch(`/api/transactions/${transaction.id}`, {
            type: "TRANSFER",
            value: values.amount,
            date: values.date,
            description: values.description || undefined,
            carteiraId: values.carteiraOrigemId || undefined,
            carteiraDestinoId: values.carteiraDestinoId || undefined,
          });
        } else {
          await api.patch(`/api/transactions/${transaction.id}`, {
            ...buildTransactionPayload({ ...values, type: tab }),
            carteiraId: values.carteiraId || undefined,
          });
        }
      } else if (tab === "TRANSFER") {
        await api.post("/api/wallets/transfer", {
          carteiraOrigemId: values.carteiraOrigemId,
          carteiraDestinoId: values.carteiraDestinoId,
          value: values.amount,
          description: values.description || undefined,
          date: values.date,
        });
      } else {
        await api.post("/api/transactions", {
          ...buildTransactionPayload({ ...values, type: tab }),
          carteiraId: values.carteiraId,
          goalId: tab === "INCOME" ? values.goalId || undefined : undefined,
        });
      }
    },
    onSuccess: (_, values) => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["category-breakdown"] });
      if (activeTabRef.current === "EXPENSE" || values.goalId) {
        queryClient.invalidateQueries({ queryKey: ["goals"] });
      }
      onClose();
    },
    onError: (error) => {
      setFieldErrorsFromApi(error, form.setError as never, [
        "amount",
        "categoryId",
        "carteiraId",
        "carteiraOrigemId",
        "carteiraDestinoId",
        "date",
        "description",
      ]);
    },
  });

  const carteiraDestinoId = form.watch("carteiraDestinoId");
  const destinoWallet = wallets.find((w) => w._id === carteiraDestinoId);
  const transferDescriptionPlaceholder = destinoWallet
    ? `Transferência para ${destinoWallet.nome}`
    : "Observação opcional";

  const categoryId = form.watch("categoryId");
  const activeCategories = activeTab === "INCOME" ? incomeCatsQuery.data : expenseCatsQuery.data;
  const selectedCategory = activeCategories?.find((c) => c.id === categoryId);
  const expenseIncomeDescriptionPlaceholder = selectedCategory
    ? activeTab === "INCOME"
      ? `Receita de ${selectedCategory.name}`
      : `Gasto com ${selectedCategory.name}`
    : "Observação opcional";

  const descriptionPlaceholder =
    activeTab === "TRANSFER" ? transferDescriptionPlaceholder : expenseIncomeDescriptionPlaceholder;

  const cfg = tabConfig[activeTab];
  const submitLabel = isEditing ? "Salvar Alterações" : cfg.submitLabel;
  const submitDisabled =
    mutation.isPending ||
    (activeTab === "TRANSFER" ? !hasEnoughWallets : !hasWallets);

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={isEditing ? "Editar Movimentação" : "Nova Movimentação"}
      icon={<cfg.icon className={cn("h-6 w-6", cfg.iconCls)} />}
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
            form="transaction-modal-form"
            disabled={submitDisabled}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70",
              cfg.submitCls,
            )}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitLabel}
          </button>
        </div>
      }
    >
      {/* Segmented control */}
      <div className="mb-5 flex rounded-xl bg-bg-muted p-1">
        {(["INCOME", "EXPENSE", "TRANSFER"] as Tab[]).map((tab) => {
          const t = tabConfig[tab];
          const Icon = t.icon;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition",
                activeTab === tab ? t.activeCls : "text-text-secondary hover:text-text-primary",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Transfer: sem carteiras suficientes */}
      {activeTab === "TRANSFER" && !hasEnoughWallets ? (
        <div className="rounded-xl bg-bg-muted p-5 text-center text-sm text-text-secondary">
          <ArrowLeftRight className="mx-auto mb-3 h-8 w-8 text-text-muted" />
          <p>
            Você precisa de pelo menos <strong className="text-white">2 carteiras</strong> para realizar uma
            transferência.
          </p>
          <Link
            to="/carteiras"
            onClick={onClose}
            className="mt-3 inline-block font-bold text-accent-gold underline underline-offset-2 hover:brightness-110"
          >
            Criar carteira agora →
          </Link>
        </div>
      ) : (
        <form
          id="transaction-modal-form"
          className="space-y-5"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <AmountField control={form.control} errors={form.formState.errors} />

          {/* INCOME / EXPENSE */}
          {activeTab !== "TRANSFER" && (
            <>
              <Controller
                control={form.control}
                name="carteiraId"
                render={({ field, fieldState }) => (
                  <WalletField
                    wallets={wallets}
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                    loading={walletsQuery.isLoading}
                  />
                )}
              />
              {activeTab === "INCOME" && !isEditing && (
                <Controller
                  control={form.control}
                  name="goalId"
                  render={({ field }) => (
                    <GoalField
                      goals={openGoals}
                      value={field.value}
                      onChange={field.onChange}
                      loading={openGoalsQuery.isLoading}
                    />
                  )}
                />
              )}
              <Controller
                control={form.control}
                name="categoryId"
                render={({ field, fieldState }) => (
                  <CategoryField
                    categories={
                      (activeTab === "INCOME" ? incomeCatsQuery.data : expenseCatsQuery.data) ?? []
                    }
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                    loading={
                      activeTab === "INCOME" ? incomeCatsQuery.isLoading : expenseCatsQuery.isLoading
                    }
                  />
                )}
              />
            </>
          )}

          {/* TRANSFER */}
          {activeTab === "TRANSFER" && (
            <>
              <div>
                <span className="mb-2 block text-sm text-text-secondary">De (origem)</span>
                <select {...form.register("carteiraOrigemId")} className={selectCls}>
                  <option value="">Selecione a carteira de origem...</option>
                  {wallets.map((w) => (
                    <option key={w._id} value={w._id}>
                      {w.nome}
                    </option>
                  ))}
                </select>
                {form.formState.errors.carteiraOrigemId && (
                  <p className="mt-1 text-xs text-accent-red">
                    {form.formState.errors.carteiraOrigemId.message}
                  </p>
                )}
              </div>
              <div>
                <span className="mb-2 block text-sm text-text-secondary">Para (destino)</span>
                <select {...form.register("carteiraDestinoId")} className={selectCls}>
                  <option value="">Selecione a carteira de destino...</option>
                  {wallets.map((w) => (
                    <option key={w._id} value={w._id}>
                      {w.nome}
                    </option>
                  ))}
                </select>
                {form.formState.errors.carteiraDestinoId && (
                  <p className="mt-1 text-xs text-accent-red">
                    {form.formState.errors.carteiraDestinoId.message}
                  </p>
                )}
              </div>
            </>
          )}

          <DateAndDescriptionFields
            register={form.register as never}
            watch={form.watch as never}
            errors={form.formState.errors}
            descriptionPlaceholder={descriptionPlaceholder}
          />

          {mutation.isError && (
            <div className="rounded-xl bg-accent-red/10 p-3 text-sm text-accent-red">
              {getApiErrorMessages(mutation.error, "Não foi possível salvar.").map((m) => (
                <p key={m}>{m}</p>
              ))}
            </div>
          )}
        </form>
      )}
    </ModalShell>
  );
}
