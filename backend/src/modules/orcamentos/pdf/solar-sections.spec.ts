import { buildGenerationChartSvg, buildSolarEquipmentTable, buildSolarSectionsHtml } from './solar-sections';
import { formatPaybackPeriod, formatYears } from './format';
import { SolarDetails } from '../schemas/solar-details.schema';

const monthly = [
  { month: 1, kwh: 900 },
  { month: 2, kwh: 780 },
  { month: 3, kwh: 800 },
  { month: 4, kwh: 730 },
  { month: 5, kwh: 820 },
  { month: 6, kwh: 840 },
  { month: 7, kwh: 920 },
  { month: 8, kwh: 1000 },
  { month: 9, kwh: 1010 },
  { month: 10, kwh: 1020 },
  { month: 11, kwh: 960 },
  { month: 12, kwh: 940 },
];

const makeSolar = (overrides: Partial<SolarDetails> = {}): SolarDetails =>
  ({
    panels: [{ quantity: 12, wattagePeak: 550, model: 'Canadian 550W' }],
    inverters: [{ quantity: 1, type: 'INVERSOR', model: 'Growatt 6kW', wattage: 6000 }],
    warranties: {
      panelEfficiencyYears: 25,
      panelDefectYears: 12,
      inverterYears: 10,
      installationYears: 5,
    },
    generation: {
      systemPowerKwp: 6.6,
      performanceRatio: 0.78,
      monthly,
      annualKwh: 10720,
      averageMonthlyKwh: 893.33,
      averageWeeklyKwh: 206.15,
      monthlyIrradiance: [5.4, 5.1, 4.8, 4.6, 5.0, 5.3, 5.6, 6.1, 6.3, 6.2, 6.0, 5.7],
    },
    financials: {
      investment: 30000,
      currentMonthlyBill: 850,
      projectedMonthlyBill: 120,
      monthlySavings: 730,
      annualSavings: 8760,
      horizonYears: 25,
      totalSavings: 219000,
      irrPercent: 29.15,
      paybackMonths: 42,
    },
    ...overrides,
  }) as SolarDetails;

describe('formatPaybackPeriod', () => {
  it('writes years and months in words, never a decimal', () => {
    expect(formatPaybackPeriod(42)).toBe('3 anos e 6 meses');
    expect(formatPaybackPeriod(12)).toBe('1 ano');
    expect(formatPaybackPeriod(7)).toBe('7 meses');
    expect(formatPaybackPeriod(13)).toBe('1 ano e 1 mês');
  });
});

describe('formatYears', () => {
  it('omits the value when the warranty was never configured', () => {
    expect(formatYears(undefined)).toBeUndefined();
  });

  it('agrees in number', () => {
    expect(formatYears(1)).toBe('1 ano');
    expect(formatYears(25)).toBe('25 anos');
  });
});

describe('buildGenerationChartSvg', () => {
  it('draws one bar per month', () => {
    const svg = buildGenerationChartSvg(monthly);
    expect(svg.match(/<rect /g)).toHaveLength(12);
  });

  it('labels every month', () => {
    const svg = buildGenerationChartSvg(monthly);
    for (const label of ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']) {
      expect(svg).toContain(`>${label}</text>`);
    }
  });

  it('scales bars against the highest month, so a taller month draws a taller bar', () => {
    const svg = buildGenerationChartSvg([
      { month: 1, kwh: 1000 },
      { month: 2, kwh: 500 },
    ]);
    const heights = [...svg.matchAll(/height="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(heights[0]).toBeGreaterThan(heights[1]);
  });

  // Sem isso, doze meses idênticos dividiriam por zero e sumiriam do gráfico.
  it('still draws bars when every month generates the same', () => {
    const svg = buildGenerationChartSvg([
      { month: 1, kwh: 800 },
      { month: 2, kwh: 800 },
    ]);
    const heights = [...svg.matchAll(/height="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(heights.every((h) => h > 0)).toBe(true);
  });

  it('returns nothing for an empty series instead of an empty chart frame', () => {
    expect(buildGenerationChartSvg([])).toBe('');
  });

  // O Chromium do PDF roda sem rede: um <script> externo nunca carregaria.
  it('embeds the chart inline, with no external script or image', () => {
    const svg = buildGenerationChartSvg(monthly);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('http');
  });
});

describe('buildSolarSectionsHtml', () => {
  it('prints generation, warranties, financial indicators and savings', () => {
    const html = buildSolarSectionsHtml(makeSolar());

    expect(html).toContain('Geração de energia estimada');
    expect(html).toContain('Garantias do sistema');
    expect(html).toContain('Indicadores financeiros');
    expect(html).toContain('Economia estimada');
  });

  it('shows the system power, weekly and monthly averages', () => {
    const html = buildSolarSectionsHtml(makeSolar());

    // Duas casas fixas: "6,60 kWp" é como proposta fotovoltaica escreve potência.
    expect(html).toContain('6,60 kWp');
    expect(html).toContain('Média semanal');
    expect(html).toContain('Média mensal');
  });

  it('shows the bill before and after the system', () => {
    const html = buildSolarSectionsHtml(makeSolar());

    expect(html).toContain('Fatura mensal atual');
    expect(html).toContain('Com o sistema instalado');
    expect(html).toContain('Economia em 25 anos');
  });

  it('prints the payback in years and months, and the IRR as a percentage', () => {
    const html = buildSolarSectionsHtml(makeSolar());

    expect(html).toContain('3 anos e 6 meses');
    expect(html).toContain('29,15%');
  });

  it('omits the whole generation section when the budget has no irradiance', () => {
    const html = buildSolarSectionsHtml(makeSolar({ generation: undefined }));

    expect(html).not.toContain('Geração de energia estimada');
    expect(html).not.toContain('<svg');
    // As demais seções continuam saindo normalmente.
    expect(html).toContain('Indicadores financeiros');
    expect(html).toContain('Economia estimada');
  });

  it('omits the warranties section when the company configured none', () => {
    const html = buildSolarSectionsHtml(makeSolar({ warranties: {} }));

    expect(html).not.toContain('Garantias do sistema');
    expect(html).toContain('Indicadores financeiros');
  });

  it('prints only the warranties that were configured', () => {
    const html = buildSolarSectionsHtml(makeSolar({ warranties: { inverterYears: 10 } }));

    expect(html).toContain('Garantias do sistema');
    expect(html).toContain('Inversor / microinversor');
    expect(html).not.toContain('Painel — eficiência');
  });

  // Prometer "0 anos" ou "—" de retorno seria pior do que não prometer nada.
  it('omits payback and IRR when there is no return to project', () => {
    const solar = makeSolar();
    const html = buildSolarSectionsHtml({
      ...solar,
      financials: { ...solar.financials, irrPercent: undefined, paybackMonths: undefined },
    } as SolarDetails);

    expect(html).toContain('Valor do investimento');
    expect(html).not.toContain('T.I.R.');
    expect(html).not.toContain('Payback');
  });

  it('escapes an unsafe equipment model instead of injecting it raw', () => {
    const html = buildSolarEquipmentTable(
      makeSolar({ panels: [{ quantity: 1, wattagePeak: 550, model: '<script>alert(1)</script>' }] }),
      0,
      0,
      30000,
    );

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('buildSolarEquipmentTable', () => {
  it('lists panels and inverters with quantity and power', () => {
    const html = buildSolarEquipmentTable(makeSolar(), 0, 0, 30000);

    expect(html).toContain('Painel solar Canadian 550W');
    expect(html).toContain('550 Wp');
    expect(html).toContain('Inversor Growatt 6kW');
    expect(html).toContain('6.000 W');
  });

  it('names a microinverter as such', () => {
    const html = buildSolarEquipmentTable(
      makeSolar({ inverters: [{ quantity: 8, type: 'MICROINVERSOR' }] as SolarDetails['inverters'] }),
      0,
      0,
      30000,
    );

    expect(html).toContain('Microinversor');
  });

  it('shows a dash when the order does not state the inverter power', () => {
    const html = buildSolarEquipmentTable(
      makeSolar({ inverters: [{ quantity: 1, type: 'INVERSOR' }] as SolarDetails['inverters'] }),
      0,
      0,
      30000,
    );

    expect(html).toContain('—');
  });

  it('adds travel cost and discount on top of the system value', () => {
    const html = buildSolarEquipmentTable(makeSolar(), 150, 1000, 29150);

    expect(html).toContain('Deslocamento');
    expect(html).toContain('Desconto');
    expect(html).toContain('Total');
  });

  it('omits the travel and discount rows when they are zero', () => {
    const html = buildSolarEquipmentTable(makeSolar(), 0, 0, 30000);

    expect(html).not.toContain('Deslocamento');
    expect(html).not.toContain('Desconto');
  });
});
