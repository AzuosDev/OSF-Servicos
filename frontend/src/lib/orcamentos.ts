import type { BudgetStatus } from "../types/api";

export const BUDGET_STATUS_LABEL: Record<BudgetStatus, string> = {
  RASCUNHO: "Rascunho",
  ENVIADO: "Enviado",
  APROVADO: "Aprovado",
  REJEITADO: "Rejeitado",
  EXPIRADO: "Expirado",
  CANCELADO: "Cancelado",
};

export const BUDGET_STATUS_BADGE_CLASS: Record<BudgetStatus, string> = {
  RASCUNHO: "bg-bg-overlay text-text-secondary",
  ENVIADO: "bg-accent-blue/20 text-accent-blue",
  APROVADO: "bg-accent-green/15 text-accent-green",
  REJEITADO: "bg-accent-red/15 text-accent-red",
  EXPIRADO: "bg-accent-orange/15 text-accent-orange",
  CANCELADO: "bg-bg-muted text-text-muted",
};

export const BUDGET_STATUS_TRANSITIONS: Record<BudgetStatus, BudgetStatus[]> = {
  RASCUNHO: ["ENVIADO", "CANCELADO"],
  ENVIADO: ["APROVADO", "REJEITADO", "EXPIRADO", "CANCELADO"],
  APROVADO: ["CANCELADO"],
  REJEITADO: [],
  EXPIRADO: [],
  CANCELADO: [],
};

export function defaultValidUntilInputValue(daysFromNow = 7): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}
