import {
  DEFAULT_PERFORMANCE_RATIO,
  calculateFinancialIndicators,
  calculatePayback,
  estimateGeneration,
  estimateSavings,
  internalRateOfReturn,
  systemPowerKwp,
} from './solar-calculations';

/** Irradiação mensal (HSP) de um ponto do Ceará — seca no meio do ano, chuvas no começo. */
const FORTALEZA_IRRADIANCE = [5.4, 5.1, 4.8, 4.6, 5.0, 5.3, 5.6, 6.1, 6.3, 6.2, 6.0, 5.7];

/** Irradiação constante: facilita conferir a conta na mão. */
const FLAT_IRRADIANCE = Array<number>(12).fill(5);

describe('systemPowerKwp', () => {
  it('converts watt-peak to kWp', () => {
    expect(systemPowerKwp([{ quantity: 10, wattagePeak: 550 }])).toBe(5.5);
  });

  it('sums panel models of different wattage in the same kit', () => {
    expect(
      systemPowerKwp([
        { quantity: 8, wattagePeak: 550 },
        { quantity: 4, wattagePeak: 450 },
      ]),
    ).toBe(6.2);
  });

  it('returns zero for an empty list', () => {
    expect(systemPowerKwp([])).toBe(0);
  });

  it('rejects negative quantity or wattage', () => {
    expect(() => systemPowerKwp([{ quantity: -1, wattagePeak: 550 }])).toThrow();
    expect(() => systemPowerKwp([{ quantity: 10, wattagePeak: -550 }])).toThrow();
  });

  it('rejects non-numeric input', () => {
    expect(() => systemPowerKwp([{ quantity: NaN, wattagePeak: 550 }])).toThrow();
  });
});

describe('estimateGeneration', () => {
  it('applies kWp x HSP x performance ratio x days in month', () => {
    // 5 kWp x 5 HSP x 0.8 x 31 dias = 620 kWh em janeiro
    const result = estimateGeneration(5, FLAT_IRRADIANCE, 0.8);
    expect(result.monthly[0].kwh).toBe(620);
    // Fevereiro tem 28 dias: 5 x 5 x 0.8 x 28 = 560
    expect(result.monthly[1].kwh).toBe(560);
  });

  it('returns the twelve months labelled in order', () => {
    const result = estimateGeneration(5, FLAT_IRRADIANCE);
    expect(result.monthly).toHaveLength(12);
    expect(result.monthly[0]).toMatchObject({ month: 1, label: 'Jan' });
    expect(result.monthly[11]).toMatchObject({ month: 12, label: 'Dez' });
  });

  it('keeps the annual total equal to the sum of the printed columns', () => {
    const result = estimateGeneration(6.2, FORTALEZA_IRRADIANCE);
    const sumOfColumns = result.monthly.reduce((sum, month) => sum + month.kwh, 0);
    expect(result.annualKwh).toBeCloseTo(sumOfColumns, 2);
  });

  it('varies across the year following the local irradiance, with no artificial factor', () => {
    const result = estimateGeneration(5, FORTALEZA_IRRADIANCE);
    const april = result.monthly[3].kwh; // chuvoso no Ceará
    const september = result.monthly[8].kwh; // seco
    expect(september).toBeGreaterThan(april);
  });

  it('derives weekly and monthly averages from the annual total', () => {
    const result = estimateGeneration(5, FLAT_IRRADIANCE, 0.8);
    expect(result.averageMonthlyKwh).toBeCloseTo(result.annualKwh / 12, 2);
    expect(result.averageWeeklyKwh).toBeCloseTo(result.annualKwh / 52, 2);
  });

  it('uses the default performance ratio when none is given', () => {
    const withDefault = estimateGeneration(5, FLAT_IRRADIANCE);
    const explicit = estimateGeneration(5, FLAT_IRRADIANCE, DEFAULT_PERFORMANCE_RATIO);
    expect(withDefault.annualKwh).toBe(explicit.annualKwh);
  });

  it('generates nothing when the system has no power', () => {
    const result = estimateGeneration(0, FLAT_IRRADIANCE);
    expect(result.annualKwh).toBe(0);
  });

  it('rejects an irradiance series that is not twelve months', () => {
    expect(() => estimateGeneration(5, [5, 5, 5])).toThrow(/12 valores/);
  });

  it('rejects a performance ratio outside 0-1', () => {
    expect(() => estimateGeneration(5, FLAT_IRRADIANCE, 0)).toThrow();
    expect(() => estimateGeneration(5, FLAT_IRRADIANCE, 1.2)).toThrow();
  });

  it('rejects negative irradiance', () => {
    const broken = [...FLAT_IRRADIANCE];
    broken[2] = -1;
    expect(() => estimateGeneration(5, broken)).toThrow(/Mar/);
  });
});

describe('estimateSavings', () => {
  it('computes monthly, annual and horizon savings', () => {
    const savings = estimateSavings(850, 120, 25);
    expect(savings.monthlySavings).toBe(730);
    expect(savings.annualSavings).toBe(8760);
    expect(savings.totalSavings).toBe(219000);
  });

  it('reports zero savings when the bill does not change', () => {
    const savings = estimateSavings(500, 500, 25);
    expect(savings.monthlySavings).toBe(0);
    expect(savings.totalSavings).toBe(0);
  });

  it('allows a negative saving when the projected bill is higher', () => {
    const savings = estimateSavings(300, 400, 10);
    expect(savings.monthlySavings).toBe(-100);
  });

  it('rejects an invalid horizon', () => {
    expect(() => estimateSavings(850, 120, 0)).toThrow();
    expect(() => estimateSavings(850, 120, 2.5)).toThrow();
  });

  it('rejects negative bills', () => {
    expect(() => estimateSavings(-1, 120, 25)).toThrow();
    expect(() => estimateSavings(850, -1, 25)).toThrow();
  });
});

describe('calculatePayback', () => {
  it('splits the period into years and months', () => {
    // 30000 / 640 = 46.875 meses -> arredonda para cima: 47 meses = 3 anos e 11 meses
    const payback = calculatePayback(30000, 640);
    expect(payback).toEqual({ years: 3, months: 11, totalMonths: 47 });
  });

  it('reports a whole number of years with zero months', () => {
    expect(calculatePayback(12000, 1000)).toEqual({ years: 1, months: 0, totalMonths: 12 });
  });

  it('rounds up, never leaving the investment partially unpaid', () => {
    // 1000 / 999 = 1.001 meses -> 2 meses, porque no mês 1 ainda falta pagar
    expect(calculatePayback(1000, 999)?.totalMonths).toBe(2);
  });

  it('returns null when there is no saving to pay the system back', () => {
    expect(calculatePayback(30000, 0)).toBeNull();
    expect(calculatePayback(30000, -50)).toBeNull();
  });

  it('rejects a non-positive investment', () => {
    expect(() => calculatePayback(0, 500)).toThrow();
    expect(() => calculatePayback(-1000, 500)).toThrow();
  });
});

describe('internalRateOfReturn', () => {
  it('finds the rate that zeroes the net present value', () => {
    // -1000 hoje e 1100 em um ano = 10% ao ano
    expect(internalRateOfReturn([-1000, 1100])).toBeCloseTo(10, 1);
  });

  it('matches a known multi-period case', () => {
    // -1000 com 500/ano por 3 anos: T.I.R. ~ 23,38% a.a.
    expect(internalRateOfReturn([-1000, 500, 500, 500])).toBeCloseTo(23.38, 1);
  });

  it('returns a negative rate when the investment is not recovered', () => {
    const irr = internalRateOfReturn([-1000, 100, 100, 100]);
    expect(irr).not.toBeNull();
    expect(irr as number).toBeLessThan(0);
  });

  it('handles the high returns typical of a solar system', () => {
    // 30000 investidos, 8760/ano por 25 anos
    const irr = internalRateOfReturn([-30000, ...Array<number>(25).fill(8760)]);
    expect(irr).not.toBeNull();
    expect(irr as number).toBeGreaterThan(25);
  });

  it('returns null when the cash flow never changes sign', () => {
    expect(internalRateOfReturn([-1000, -500])).toBeNull();
    expect(internalRateOfReturn([1000, 500])).toBeNull();
  });

  it('returns null for a cash flow too short to solve', () => {
    expect(internalRateOfReturn([-1000])).toBeNull();
  });

  it('rejects a cash flow with non-numeric entries', () => {
    expect(() => internalRateOfReturn([-1000, NaN])).toThrow();
  });

  // A taxa sai arredondada em duas casas para impressão, então descontar por ela deixa um
  // resíduo — de R$ 1,28 num investimento de R$ 30.000. O que importa é que seja desprezível
  // perto do investimento, não que zere no centavo.
  it('is consistent: discounting at the published rate leaves a negligible NPV', () => {
    const investment = 30000;
    const flows = [-investment, ...Array<number>(25).fill(8760)];
    const rate = (internalRateOfReturn(flows) as number) / 100;
    const npv = flows.reduce((sum, flow, period) => sum + flow / (1 + rate) ** period, 0);
    expect(Math.abs(npv)).toBeLessThan(investment * 0.0001);
  });
});

describe('calculateFinancialIndicators', () => {
  it('assembles investment, savings, IRR and payback', () => {
    const result = calculateFinancialIndicators(30000, 850, 120, 25);

    expect(result.investment).toBe(30000);
    expect(result.savings.monthlySavings).toBe(730);
    expect(result.savings.annualSavings).toBe(8760);
    // 30000 / 730 = 41,09 meses -> 42 meses, arredondando para cima
    expect(result.payback).toEqual({ years: 3, months: 6, totalMonths: 42 });
    expect(result.irrPercent).not.toBeNull();
    expect(result.irrPercent as number).toBeGreaterThan(0);
  });

  it('defaults to a 25-year horizon', () => {
    const result = calculateFinancialIndicators(30000, 850, 120);
    expect(result.savings.horizonYears).toBe(25);
  });

  it('reports no payback and no IRR when the bill does not drop', () => {
    const result = calculateFinancialIndicators(30000, 500, 500, 25);
    expect(result.payback).toBeNull();
    expect(result.irrPercent).toBeNull();
  });

  it('rejects a non-positive investment', () => {
    expect(() => calculateFinancialIndicators(0, 850, 120)).toThrow();
  });
});
