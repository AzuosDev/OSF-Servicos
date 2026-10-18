import type { SolarInverterType } from "../types/api";

/**
 * Estado do formulário de venda de sistema solar e sua conversão para o corpo da API.
 *
 * Fica separado da tela para poder ser testado sem montar componente: é aqui que mora a
 * regra de "o que conta como preenchido", e um engano nela deixaria o usuário travado no
 * botão Continuar sem saber por quê.
 */

/** Quantidade e potência são strings porque "" precisa ser diferente de 0 no formulário. */
export type SolarPanelFormRow = {
  quantity: string;
  wattagePeak: string;
  model: string;
};

export type SolarInverterFormRow = {
  quantity: string;
  type: SolarInverterType;
  model: string;
  wattage: string;
};

export type SolarFormState = {
  panels: SolarPanelFormRow[];
  inverters: SolarInverterFormRow[];
  /** Valores monetários são números: vêm do CurrencyInput, que nunca devolve vazio. */
  investment: number;
  currentMonthlyBill: number;
  projectedMonthlyBill: number;
};

export const emptyPanelRow = (): SolarPanelFormRow => ({ quantity: "", wattagePeak: "", model: "" });

export const emptyInverterRow = (): SolarInverterFormRow => ({
  quantity: "",
  type: "INVERSOR",
  model: "",
  wattage: "",
});

export const emptySolarForm = (): SolarFormState => ({
  panels: [emptyPanelRow()],
  inverters: [emptyInverterRow()],
  investment: 0,
  currentMonthlyBill: 0,
  projectedMonthlyBill: 0,
});

/** Inteiro positivo digitado; qualquer outra coisa (vazio, texto, 0, decimal) é inválida. */
function positiveInteger(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

const isPanelRowComplete = (row: SolarPanelFormRow) =>
  positiveInteger(row.quantity) !== null && positiveInteger(row.wattagePeak) !== null;

const isInverterRowComplete = (row: SolarInverterFormRow) => positiveInteger(row.quantity) !== null;

/**
 * O que ainda falta preencher, em linguagem de usuário. Lista vazia significa pronto para
 * enviar — mostrar o motivo é melhor do que só desabilitar o botão.
 */
export function solarFormIssues(form: SolarFormState): string[] {
  const issues: string[] = [];

  if (!form.panels.some(isPanelRowComplete)) {
    issues.push("Informe ao menos um painel com quantidade e potência.");
  }
  if (!form.inverters.some(isInverterRowComplete)) {
    issues.push("Informe ao menos um inversor ou microinversor com quantidade.");
  }
  if (form.investment <= 0) {
    issues.push("Informe o valor do pedido.");
  }
  if (form.currentMonthlyBill <= 0) {
    issues.push("Informe a fatura de energia atual do cliente.");
  }
  if (form.projectedMonthlyBill > form.currentMonthlyBill) {
    issues.push("A fatura com o sistema não pode ser maior que a fatura atual.");
  }

  return issues;
}

export const isSolarFormValid = (form: SolarFormState) => solarFormIssues(form).length === 0;

/** Economia mensal projetada — o mesmo número que o backend vai calcular. */
export const projectedMonthlySavings = (form: SolarFormState) =>
  Math.max(0, form.currentMonthlyBill - form.projectedMonthlyBill);

/** Potência total em kWp, para conferência na tela antes de enviar. */
export function formSystemPowerKwp(form: SolarFormState): number {
  const watts = form.panels.reduce((sum, row) => {
    const quantity = positiveInteger(row.quantity);
    const wattage = positiveInteger(row.wattagePeak);
    return quantity && wattage ? sum + quantity * wattage : sum;
  }, 0);

  return Math.round((watts / 1000) * 1000) / 1000;
}

/**
 * Corpo do campo `solar` do POST. Linhas incompletas são descartadas em vez de virarem
 * zeros — o backend rejeitaria, e o usuário não saberia qual linha causou o erro.
 */
export function toSolarPayload(form: SolarFormState) {
  return {
    panels: form.panels
      .filter(isPanelRowComplete)
      .map((row) => ({
        quantity: positiveInteger(row.quantity) as number,
        wattagePeak: positiveInteger(row.wattagePeak) as number,
        ...(row.model.trim() && { model: row.model.trim() }),
      })),
    inverters: form.inverters
      .filter(isInverterRowComplete)
      .map((row) => ({
        quantity: positiveInteger(row.quantity) as number,
        type: row.type,
        ...(row.model.trim() && { model: row.model.trim() }),
        ...(positiveInteger(row.wattage) !== null && { wattage: positiveInteger(row.wattage) as number }),
      })),
    investment: form.investment,
    currentMonthlyBill: form.currentMonthlyBill,
    projectedMonthlyBill: form.projectedMonthlyBill,
  };
}

/** Resposta de `POST /api/orcamentos/solar/parse-order`. */
export type ParsedSolarOrder = {
  panels: { quantity?: number; wattagePeak: number; model?: string; sourceLine: string }[];
  inverters: {
    quantity?: number;
    type: SolarInverterType;
    wattage?: number;
    model?: string;
    sourceLine: string;
  }[];
  investment?: number;
  warnings: string[];
};

/**
 * Converte o rascunho lido do pedido em estado de formulário.
 *
 * Preserva as faturas já digitadas: elas não vêm no pedido da distribuidora, e reenviar o
 * PDF não pode apagar o que o usuário preencheu à mão. O que o parser não reconheceu vira
 * campo vazio, nunca zero — vazio o usuário nota e preenche, zero passa despercebido.
 */
export function solarFormFromParsedOrder(parsed: ParsedSolarOrder, current: SolarFormState): SolarFormState {
  const panels = parsed.panels.map((panel) => ({
    quantity: panel.quantity != null ? String(panel.quantity) : "",
    wattagePeak: String(panel.wattagePeak),
    model: panel.model ?? "",
  }));

  const inverters = parsed.inverters.map((inverter) => ({
    quantity: inverter.quantity != null ? String(inverter.quantity) : "",
    type: inverter.type,
    model: inverter.model ?? "",
    wattage: inverter.wattage != null ? String(inverter.wattage) : "",
  }));

  return {
    panels: panels.length > 0 ? panels : current.panels,
    inverters: inverters.length > 0 ? inverters : current.inverters,
    investment: parsed.investment ?? current.investment,
    currentMonthlyBill: current.currentMonthlyBill,
    projectedMonthlyBill: current.projectedMonthlyBill,
  };
}
