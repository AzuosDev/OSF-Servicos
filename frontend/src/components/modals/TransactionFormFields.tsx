import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { FieldErrors, UseFormRegister, UseFormWatch } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";

import { DynamicIcon } from "../DynamicIcon";
import { api } from "../../lib/api";
import { asArray, normalizeCategory } from "../../lib/finance";
import { cn } from "../../lib/utils";
import type { Category as ApiCategory } from "../../types/api";
import type { Category } from "../../types/finance";

export type TransactionFormValues = {
  amount: number;
  categoryId?: string;
  date: string;
  description?: string;
};

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await api.get<ApiCategory[]>("/api/categories");
      const source =
        typeof data === "object" && data !== null && "categories" in data
          ? (data as { categories?: unknown }).categories
          : data;

      return asArray(source).map((item, index) => normalizeCategory(item, index));
    },
  });
}

export function useIncomeCategories() {
  return useQuery<Category[]>({
    queryKey: ["categories", "income"],
    queryFn: async () => {
      const { data } = await api.get<ApiCategory[]>("/api/categories", { params: { income: "true" } });
      const source =
        typeof data === "object" && data !== null && "categories" in data
          ? (data as { categories?: unknown }).categories
          : data;

      return asArray(source).map((item, index) => normalizeCategory(item, index));
    },
  });
}

export function AmountField({
  register,
  errors,
}: {
  register: UseFormRegister<any>;
  errors: any;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-text-secondary">Valor</span>
      <div className="flex items-center rounded-2xl border border-bg-muted bg-bg-muted px-4 py-3 focus-within:border-accent-lime">
        <span className="font-sans text-2xl font-bold text-text-secondary">R$</span>
        <input
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          className="w-full bg-transparent text-center font-sans text-3xl font-bold text-accent-lime outline-none"
          {...register("amount", { valueAsNumber: true })}
        />
      </div>
      {errors.amount && (
        <p className="mt-2 text-xs text-accent-red">{errors.amount.message}</p>
      )}
    </label>
  );
}

export function CategoryField({
  categories,
  value,
  onChange,
  error,
  loading,
}: {
  categories: Category[];
  value?: string;
  onChange: (categoryId: string) => void;
  error?: string;
  loading: boolean;
}) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      await api.delete(`/api/categories/${categoryId}`);
    },
    onSuccess: (_, categoryId) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      if (value === categoryId) {
        onChange("");
      }
    },
  });

  return (
    <div>
      <span className="mb-2 block text-sm text-text-secondary">Categoria</span>
      <div className="max-h-48 overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-xl bg-bg-muted" />
              ))
            : categories.map((category) => {
                const active = category.id === value;

                return (
                  <div key={category.id} className="group/cat relative">
                    <button
                      type="button"
                      onClick={() => onChange(category.id)}
                      className={cn(
                        "flex min-h-20 w-full flex-col items-center justify-center gap-2 rounded-xl border bg-bg-muted p-3 text-center text-xs font-semibold transition",
                        active
                          ? "border-accent-lime text-white"
                          : "border-transparent text-text-secondary hover:border-bg-overlay hover:text-white",
                      )}
                    >
                      <span
                        className="grid h-9 w-9 place-items-center rounded-xl"
                        style={{ backgroundColor: `${category.color}22` }}
                      >
                        <DynamicIcon
                          name={category.icon}
                          className="h-5 w-5"
                          style={{ color: category.color }}
                        />
                      </span>
                      <span className="line-clamp-2">{category.name}</span>
                    </button>

                    {!category.isDefault && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(category.id); }}
                        disabled={deleteMutation.isPending}
                        className="absolute right-1 top-1 flex rounded-md p-0.5 text-text-muted transition hover:bg-accent-red/10 hover:text-accent-red disabled:opacity-40"
                        aria-label={`Excluir categoria ${category.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-accent-red">{error}</p>}
    </div>
  );
}

export function useWallets() {
  return useQuery<Array<{ _id: string; nome: string }>>({
    queryKey: ["wallets"],
    queryFn: async () => {
      const { data } = await api.get("/api/wallets");
      return Array.isArray(data) ? data : [];
    },
  });
}

export function WalletField({
  wallets,
  value,
  onChange,
  error,
  loading,
}: {
  wallets: Array<{ _id: string; nome: string }>;
  value?: string;
  onChange: (id: string) => void;
  error?: string;
  loading: boolean;
}) {
  if (loading) return <div className="h-12 animate-pulse rounded-xl bg-bg-muted" />;

  if (wallets.length === 0) {
    return (
      <div className="rounded-xl bg-yellow-500/10 p-3 text-sm text-yellow-400">
        ⚠️ Nenhuma carteira encontrada.{" "}
        <Link to="/carteiras" className="font-bold underline underline-offset-2 hover:text-yellow-300">
          Criar carteira agora →
        </Link>
      </div>
    );
  }

  return (
    <div>
      <span className="mb-2 block text-sm text-text-secondary">Carteira</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none transition focus:border-accent-lime"
      >
        <option value="">Selecione uma carteira…</option>
        {wallets.map((w) => (
          <option key={w._id} value={w._id}>{w.nome}</option>
        ))}
      </select>
      {error && <p className="mt-2 text-xs text-accent-red">{error}</p>}
    </div>
  );
}

export function DateAndDescriptionFields({
  register,
  watch,
  errors,
  descriptionPlaceholder = "Observação opcional",
}: {
  register: UseFormRegister<any>;
  watch: UseFormWatch<any>;
  errors: any;
  descriptionPlaceholder?: string;
}) {
  const description = watch("description") ?? "";
  const count = useMemo(() => description.length, [description]);

  return (
    <div className="grid gap-4">
      <label className="block">
        <span className="mb-2 block text-sm text-text-secondary">Data</span>
        <input
          type="date"
          className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none transition focus:border-accent-lime"
          {...register("date")}
        />
        {errors.date && (
          <p className="mt-2 text-xs text-accent-red">{errors.date.message}</p>
        )}
      </label>

      <label className="block">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-sm text-text-secondary">Descrição</span>
          <span className="text-xs text-text-muted">{count}/500</span>
        </div>
        <textarea
          rows={4}
          maxLength={500}
          className="w-full resize-none rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none transition placeholder:text-text-muted focus:border-accent-lime"
          placeholder={descriptionPlaceholder}
          {...register("description")}
        />
        {errors.description && (
          <p className="mt-2 text-xs text-accent-red">{errors.description.message}</p>
        )}
      </label>
    </div>
  );
}
