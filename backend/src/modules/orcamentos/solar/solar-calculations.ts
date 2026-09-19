/**
 * Cálculos do orçamento de venda de sistema fotovoltaico.
 *
 * Módulo puro de propósito: nada de banco, rede ou data/hora do sistema. Todo número que
 * entra vem por parâmetro e toda saída é determinística, para que o resultado impresso no
 * PDF do cliente possa ser conferido no teste antes de virar compromisso comercial.
 */

/** Dias de cada mês, janeiro a dezembro. Ano comum — proposta comercial não usa bissexto. */
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export const MONTH_LABELS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const;

/**
 * Rendimento global do sistema (performance ratio): perdas de cabeamento, temperatura,
 * sujeira e conversão. 0,75–0,80 é a faixa usual no Brasil; não é degradação anual, que a
 * pedido não é considerada — a variação entre meses vem da irradiação real do local.
 */
export const DEFAULT_PERFORMANCE_RATIO = 0.78;

export type SolarPanel = {
  /** Quantidade de painéis desse modelo. */
  quantity: number;
  /** Potência unitária em watt-pico (Wp), como vem no pedido da distribuidora. */
  wattagePeak: number;
};

export type MonthlyGeneration = {
  /** 1 = janeiro … 12 = dezembro. */
  month: number;
  label: string;
  /** Geração estimada do mês, em kWh. */
  kwh: number;
};

export type GenerationEstimate = {
  systemPowerKwp: number;
  monthly: MonthlyGeneration[];
  annualKwh: number;
  /** Média mensal do ano — não é o mês típico, é a média dos doze. */
  averageMonthlyKwh: number;
  /** Média semanal, derivada do ano inteiro dividido por 52. */
  averageWeeklyKwh: number;
};

export type PaybackPeriod = {
  years: number;
  months: number;
  /** Prazo total em meses, útil para comparar dois orçamentos. */
  totalMonths: number;
};

export type SavingsEstimate = {
  /** Fatura mensal antes do sistema. */
  currentMonthlyBill: number;
  /** Fatura mensal depois do sistema instalado. */
  projectedMonthlyBill: number;
  monthlySavings: number;
  annualSavings: number;
  /** Economia acumulada no horizonte informado. */
  horizonYears: number;
  totalSavings: number;
};

export type FinancialIndicators = {
  investment: number;
  savings: SavingsEstimate;
  /** T.I.R. anual em porcentagem (ex.: 28.4 = 28,4% a.a.). `null` quando não é calculável. */
  irrPercent: number | null;
  /** `null` quando a economia mensal é zero ou negativa — não existe retorno a projetar. */
  payback: PaybackPeriod | null;
};

const isFiniteNumber = (value: number): boolean => Number.isFinite(value);

const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/**
 * Potência instalada do sistema, em kWp. Soma todos os modelos de painel do pedido —
 * é comum a distribuidora enviar dois modelos de potência diferente no mesmo kit.
 */
export function systemPowerKwp(panels: SolarPanel[]): number {
  const totalWatts = panels.reduce((sum, panel) => {
    if (!isFiniteNumber(panel.quantity) || !isFiniteNumber(panel.wattagePeak)) {
      throw new Error('Quantidade e potência do painel precisam ser números');
    }
    if (panel.quantity < 0 || panel.wattagePeak < 0) {
      throw new Error('Quantidade e potência do painel não podem ser negativas');
    }
    return sum + panel.quantity * panel.wattagePeak;
  }, 0);

  return round(totalWatts / 1000, 3);
}

/**
 * Geração mês a mês a partir da irradiação local.
 *
 * `monthlyIrradiance` são as 12 médias diárias de irradiação (HSP, em kWh/m²/dia) do ponto
 * do cliente, de janeiro a dezembro. É daí que sai a variação ao longo do ano: o período
 * chuvoso da região já está embutido no dado medido, sem fator artificial nenhum.
 *
 * kWh do mês = kWp × HSP do mês × rendimento × dias do mês
 */
export function estimateGeneration(
  powerKwp: number,
  monthlyIrradiance: number[],
  performanceRatio: number = DEFAULT_PERFORMANCE_RATIO,
): GenerationEstimate {
  if (!isFiniteNumber(powerKwp) || powerKwp < 0) {
    throw new Error('Potência do sistema precisa ser um número não negativo');
  }
  if (monthlyIrradiance.length !== 12) {
    throw new Error('A irradiação precisa ter exatamente 12 valores (janeiro a dezembro)');
  }
  if (!isFiniteNumber(performanceRatio) || performanceRatio <= 0 || performanceRatio > 1) {
    throw new Error('O rendimento do sistema precisa estar entre 0 (exclusivo) e 1');
  }

  const monthly = monthlyIrradiance.map((irradiance, index) => {
    if (!isFiniteNumber(irradiance) || irradiance < 0) {
      throw new Error(`Irradiação inválida para ${MONTH_LABELS[index]}`);
    }
    return {
      month: index + 1,
      label: MONTH_LABELS[index],
      kwh: round(powerKwp * irradiance * performanceRatio * DAYS_IN_MONTH[index], 2),
    };
  });

  // Soma dos meses já arredondados: é o número que o cliente vê no gráfico, então o total
  // impresso precisa bater com a soma das colunas.
  const annualKwh = round(
    monthly.reduce((sum, item) => sum + item.kwh, 0),
    2,
  );

  return {
    systemPowerKwp: powerKwp,
    monthly,
    annualKwh,
    averageMonthlyKwh: round(annualKwh / 12, 2),
    averageWeeklyKwh: round(annualKwh / 52, 2),
  };
}

/**
 * Economia gerada pela troca da fatura antiga pela fatura com o sistema instalado.
 * As duas faturas são informadas manualmente — não saem do pedido da distribuidora.
 */
export function estimateSavings(
  currentMonthlyBill: number,
  projectedMonthlyBill: number,
  horizonYears: number,
): SavingsEstimate {
  if (!isFiniteNumber(currentMonthlyBill) || currentMonthlyBill < 0) {
    throw new Error('A fatura atual precisa ser um valor não negativo');
  }
  if (!isFiniteNumber(projectedMonthlyBill) || projectedMonthlyBill < 0) {
    throw new Error('A fatura projetada precisa ser um valor não negativo');
  }
  if (!Number.isInteger(horizonYears) || horizonYears <= 0) {
    throw new Error('O horizonte precisa ser um número inteiro de anos maior que zero');
  }

  const monthlySavings = round(currentMonthlyBill - projectedMonthlyBill, 2);
  const annualSavings = round(monthlySavings * 12, 2);

  return {
    currentMonthlyBill: round(currentMonthlyBill, 2),
    projectedMonthlyBill: round(projectedMonthlyBill, 2),
    monthlySavings,
    annualSavings,
    horizonYears,
    totalSavings: round(annualSavings * horizonYears, 2),
  };
}

/**
 * Payback simples: quanto tempo a economia leva para devolver o investimento.
 *
 * Trabalha em meses para não perder precisão — 3,9 anos vira "3 anos e 11 meses", não
 * "3 anos". Devolve `null` quando a economia mensal não é positiva: nesse caso o sistema
 * não se paga e inventar um prazo seria mentir para o cliente.
 */
export function calculatePayback(investment: number, monthlySavings: number): PaybackPeriod | null {
  if (!isFiniteNumber(investment) || investment <= 0) {
    throw new Error('O investimento precisa ser um valor positivo');
  }
  if (!isFiniteNumber(monthlySavings) || monthlySavings <= 0) {
    return null;
  }

  const totalMonths = Math.ceil(investment / monthlySavings);

  return {
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
    totalMonths,
  };
}

/**
 * T.I.R. anual por bisseção — a taxa que zera o valor presente do fluxo de caixa.
 *
 * Bisseção em vez de Newton-Raphson de propósito: converge sempre dentro do intervalo, sem
 * depender de chute inicial nem derivada, e desempenho é irrelevante numa conta só.
 *
 * `cashFlows[0]` é o investimento (negativo) e os seguintes são as entradas anuais.
 */
export function internalRateOfReturn(cashFlows: number[], tolerance = 1e-7): number | null {
  if (cashFlows.length < 2) return null;
  if (cashFlows.some((flow) => !isFiniteNumber(flow))) {
    throw new Error('O fluxo de caixa só aceita números');
  }

  // Sem pelo menos uma entrada e uma saída a equação não cruza o zero.
  const hasNegative = cashFlows.some((flow) => flow < 0);
  const hasPositive = cashFlows.some((flow) => flow > 0);
  if (!hasNegative || !hasPositive) return null;

  const npv = (rate: number): number =>
    cashFlows.reduce((sum, flow, period) => sum + flow / (1 + rate) ** period, 0);

  // Piso logo acima de -100%: em -1 exato a conta divide por zero.
  let low = -0.9999;
  let high = 1;

  // Se o fluxo ainda é lucrativo a 100% ao ano, sobe o teto até virar de sinal.
  while (npv(high) > 0 && high < 1e6) {
    high *= 2;
  }

  const npvLow = npv(low);
  const npvHigh = npv(high);
  if (npvLow * npvHigh > 0) return null;

  let rate = low;
  for (let i = 0; i < 200; i += 1) {
    rate = (low + high) / 2;
    const value = npv(rate);

    if (Math.abs(value) < tolerance || high - low < tolerance) break;

    if (value > 0) {
      low = rate;
    } else {
      high = rate;
    }
  }

  return round(rate * 100, 2);
}

/**
 * Indicadores financeiros do orçamento, prontos para o PDF.
 *
 * O fluxo de caixa da T.I.R. é o investimento no ano zero e a economia anual repetida pelo
 * horizonte — sem degradação anual, conforme definido para esta feature.
 */
export function calculateFinancialIndicators(
  investment: number,
  currentMonthlyBill: number,
  projectedMonthlyBill: number,
  horizonYears = 25,
): FinancialIndicators {
  if (!isFiniteNumber(investment) || investment <= 0) {
    throw new Error('O investimento precisa ser um valor positivo');
  }

  const savings = estimateSavings(currentMonthlyBill, projectedMonthlyBill, horizonYears);
  const cashFlows = [-investment, ...Array<number>(horizonYears).fill(savings.annualSavings)];

  return {
    investment: round(investment, 2),
    savings,
    irrPercent: internalRateOfReturn(cashFlows),
    payback: calculatePayback(investment, savings.monthlySavings),
  };
}
