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
  ENVIADO: "bg-accent-blueHover/10 text-accent-blueHover",
  APROVADO: "bg-accent-green/10 text-accent-green",
  REJEITADO: "bg-accent-red/10 text-accent-red",
  EXPIRADO: "bg-accent-orange/10 text-accent-orange",
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

// Mantido em espelho com backend/src/modules/orcamentos/pricing/panel-cleaning-pricing.ts
const PANEL_CLEANING_SERVICE_NAMES = ["limpeza de placas", "limpeza de placa"];

export function isPanelCleaningService(serviceName: string): boolean {
  return PANEL_CLEANING_SERVICE_NAMES.includes(serviceName.trim().toLowerCase());
}

// Até 10 placas: R$20/placa. Acima de 10: R$200 (equivalente às 10 primeiras) + R$15 por placa adicional.
export function calculatePanelCleaningSubtotal(quantity: number): number {
  if (quantity <= 10) {
    return quantity * 20;
  }
  return 200 + (quantity - 10) * 15;
}

export function calculateBudgetItemSubtotal(
  serviceName: string,
  defaultValue: number,
  quantity: number,
  unitPriceOverride?: number,
): number {
  if (unitPriceOverride == null && isPanelCleaningService(serviceName)) {
    return calculatePanelCleaningSubtotal(quantity);
  }
  return (unitPriceOverride ?? defaultValue) * quantity;
}

/** Fuso da empresa, o mesmo usado no cabeçalho do PDF gerado pelo backend. */
const APP_TIME_ZONE = "America/Fortaleza";

/**
 * Nome do arquivo PDF de um orçamento: `<cliente-em-slug>_<DD-MM-AA>` (ex.: `azuos-dev_18-08-26`).
 *
 * A data é lida no fuso da empresa, e não no do navegador nem em UTC: é assim que o
 * cabeçalho do PDF imprime, e os dois não podem discordar.
 *
 * Espelha `backend/src/modules/orcamentos/pdf/budget-pdf-filename.ts`, que nomeia o mesmo
 * arquivo no header Content-Disposition — alterar uma exige alterar a outra.
 */
export function budgetPdfFileName(clientName: string, createdAt?: string): string {
  const slug = clientName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // en-CA formata como YYYY-MM-DD, o que dá as partes já no fuso pedido.
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(createdAt ? new Date(createdAt) : new Date())
    .split("-");

  return `${slug || "cliente"}_${day}-${month}-${year.slice(-2)}`;
}

/** Preço unitário equivalente da limpeza de placas para uma quantidade, dado o preço por faixa. */
export function panelTierUnitPrice(quantity: number): number {
  return calculatePanelCleaningSubtotal(quantity) / quantity;
}

/**
 * Diz se o preço unitário gravado num item ainda corresponde à tabela por faixa. Um item criado
 * com preço manual não bate com a faixa — é assim que os dois casos são distinguidos na edição,
 * já que o orçamento guarda só o preço final, sem marcar se houve override.
 */
export function followsPanelTier(name: string, quantity: number, unitPrice: number): boolean {
  return isPanelCleaningService(name) && Math.abs(unitPrice - panelTierUnitPrice(quantity)) < 0.01;
}
