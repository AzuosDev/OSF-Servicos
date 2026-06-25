export type TransactionType = "INCOME" | "EXPENSE";

export type Category = {
  id: string;
  name: string;
  color: string;
  icon?: string;
  isDefault?: boolean;
};

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  description?: string;
  categoryId?: string;
  category?: Category;
  carteiraId?: string;
};

export type CategoryExpense = Category & {
  amount: number;
  previousAmount: number;
  variation: number;
};

