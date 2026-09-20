import {
  SolarTotals,
  buildGenerationChartSvg,
  buildSolarEquipmentTable,
  buildSolarSectionsHtml,
} from './solar-sections';
import { formatPaybackPeriod, formatYears } from './format';
import { BudgetItem } from '../schemas/budget.schema';
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

const totals = (overrides: Partial<SolarTotals> = {}): SolarTotals => ({
  travelCost: 0,
  discount: 0,
  total: 30000,
  ...overrides,
});

const service = (name: string, quantity: number, unitPrice: number): BudgetItem =>
  ({ name, quantity, unitPrice, subtotal: unitPrice * quantity }) as BudgetItem;

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
    const html = buildSolarSectionsHtml(makeSolar(), [], totals());

    expect(html).toContain('Geração de energia estimada');
    expect(html).toContain('Garantias do sistema');
    expect(html).toContain('Indicadores financeiros');
    expect(html).toContain('Economia estimada');
  });

  it('shows the system power, weekly and monthly averages', () => {
    const html = buildSolarSectionsHtml(makeSolar(), [], totals());

    // Duas casas fixas: "6,60 kWp" é como proposta fotovoltaica escreve potência.
    expect(html).toContain('6,60 kWp');
    expect(html).toContain('Média semanal');
    expect(html).toContain('Média mensal');
  });

  it('shows the bill before and after the system', () => {
    const html = buildSolarSectionsHtml(makeSolar(), [], totals());

    expect(html).toContain('Fatura mensal atual');
    expect(html).toContain('Com o sistema instalado');
    expect(html).toContain('Economia em 25 anos');
  });

  it('prints the payback in years and months, and the IRR as a percentage', () => {
    const html = buildSolarSectionsHtml(makeSolar(), [], totals());

    expect(html).toContain('3 anos e 6 meses');
    expect(html).toContain('29,15%');
  });

  it('omits the whole generation section when the budget has no irradiance', () => {
    const html = buildSolarSectionsHtml(makeSolar({ generation: undefined }), [], totals());

    expect(html).not.toContain('Geração de energia estimada');
    expect(html).not.toContain('<svg');
    // As demais seções continuam saindo normalmente.
    expect(html).toContain('Indicadores financeiros');
    expect(html).toContain('Economia estimada');
  });

  it('omits the warranties section when the company configured none', () => {
    const html = buildSolarSectionsHtml(makeSolar({ warranties: {} }), [], totals());

    expect(html).not.toContain('Garantias do sistema');
    expect(html).toContain('Indicadores financeiros');
  });

  it('prints only the warranties that were configured', () => {
    const html = buildSolarSectionsHtml(makeSolar({ warranties: { inverterYears: 10 } }), [], totals());

    expect(html).toContain('Garantias do sistema');
    expect(html).toContain('Inversor / microinversor');
    expect(html).not.toContain('Painel — eficiência');
  });

  // Prometer "0 anos" ou "—" de retorno seria pior do que não prometer nada.
  it('omits payback and IRR when there is no return to project', () => {
    const solar = makeSolar();
    const html = buildSolarSectionsHtml(
      {
        ...solar,
        financials: { ...solar.financials, irrPercent: undefined, paybackMonths: undefined },
      } as SolarDetails,
      [],
      totals(),
    );

    expect(html).toContain('Valor do investimento');
    expect(html).not.toContain('T.I.R.');
    expect(html).not.toContain('Payback');
  });

  it('escapes an unsafe equipment model instead of injecting it raw', () => {
    const html = buildSolarEquipmentTable(
      makeSolar({ panels: [{ quantity: 1, wattagePeak: 550, model: '<script>alert(1)</script>' }] }),
      totals(),
      false,
    );

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('buildSolarEquipmentTable', () => {
  it('lists panels and inverters with quantity and power', () => {
    const html = buildSolarEquipmentTable(makeSolar(), totals(), false);

    expect(html).toContain('Painel solar Canadian 550W');
    expect(html).toContain('550 Wp');
    expect(html).toContain('Inversor Growatt 6kW');
    expect(html).toContain('6.000 W');
  });

  it('names a microinverter as such', () => {
    const html = buildSolarEquipmentTable(
      makeSolar({ inverters: [{ quantity: 8, type: 'MICROINVERSOR' }] as SolarDetails['inverters'] }),
      totals(),
      false,
    );

    expect(html).toContain('Microinversor');
  });

  it('shows a dash when the order does not state the inverter power', () => {
    const html = buildSolarEquipmentTable(
      makeSolar({ inverters: [{ quantity: 1, type: 'INVERSOR' }] as SolarDetails['inverters'] }),
      totals(),
      false,
    );

    expect(html).toContain('—');
  });

  it('adds travel cost and discount on top of the system value', () => {
    const html = buildSolarEquipmentTable(makeSolar(), totals({ travelCost: 150, discount: 1000, total: 29150 }), false);

    expect(html).toContain('Deslocamento');
    expect(html).toContain('Desconto');
    expect(html).toContain('Total');
  });

  it('omits the travel and discount rows when they are zero', () => {
    const html = buildSolarEquipmentTable(makeSolar(), totals(), false);

    expect(html).not.toContain('Deslocamento');
    expect(html).not.toContain('Desconto');
  });
});

describe('serviços adicionais', () => {
  const services = [service('Instalação de padrão', 1, 1200), service('Aterramento', 2, 150)];

  it('lista os serviços com quantidade, valor unitário e subtotal', () => {
    const html = buildSolarSectionsHtml(makeSolar(), services, totals({ total: 31500 }));

    expect(html).toContain('Serviços adicionais');
    expect(html).toContain('Instalação de padrão');
    expect(html).toContain('Aterramento');
    expect(html).toContain('R$ 300,00'); // 2 × 150
  });

  // O cliente lê a proposta de cima para baixo: primeiro o que ele ganha, depois o que paga.
  it('entra depois da economia estimada e antes do fim do documento', () => {
    const html = buildSolarSectionsHtml(makeSolar(), services, totals({ total: 31500 }));

    expect(html.indexOf('Economia estimada')).toBeLessThan(html.indexOf('Serviços adicionais'));
  });

  it('fecha com o totalizador de sistema + serviços adicionais', () => {
    const html = buildSolarSectionsHtml(makeSolar(), services, totals({ total: 31500 }));
    const section = html.slice(html.indexOf('Serviços adicionais'));

    expect(section).toContain('Sistema fotovoltaico');
    expect(section).toContain('R$ 30.000,00'); // sistema
    expect(section).toContain('R$ 1.500,00'); // serviços
    expect(section).toContain('R$ 31.500,00'); // total
    expect(section).toContain('class="total-row"');
  });

  it('soma deslocamento e desconto no fecho dos serviços, não na tabela de equipamentos', () => {
    const closing = totals({ travelCost: 200, discount: 100, total: 31600 });
    const sections = buildSolarSectionsHtml(makeSolar(), services, closing);
    const equipment = buildSolarEquipmentTable(makeSolar(), closing, true);

    expect(sections).toContain('Deslocamento');
    expect(sections).toContain('Desconto');
    expect(equipment).not.toContain('Deslocamento');
    expect(equipment).not.toContain('Desconto');
  });

  // Dois totais no mesmo documento deixariam o cliente sem saber qual é o valor a pagar.
  it('deixa um único total no documento quando há serviços adicionais', () => {
    const closing = totals({ total: 31500 });
    const document =
      buildSolarEquipmentTable(makeSolar(), closing, true) +
      buildSolarSectionsHtml(makeSolar(), services, closing);

    expect(document.match(/class="total-row"/g)).toHaveLength(2); // sistema + total geral
    expect(document.match(/>Total</g)).toHaveLength(1);
  });

  it('não imprime a seção quando não há serviço adicional nenhum', () => {
    const html = buildSolarSectionsHtml(makeSolar(), [], totals());

    expect(html).not.toContain('Serviços adicionais');
  });

  // Sem serviços o documento é exatamente o que era antes: total no fim dos equipamentos.
  it('mantém o fecho na tabela de equipamentos quando não há serviços', () => {
    const html = buildSolarEquipmentTable(makeSolar(), totals({ travelCost: 150, total: 30150 }), false);

    expect(html).toContain('Deslocamento');
    expect(html).toContain('class="total-row"');
  });

  it('escapa o nome do serviço em vez de injetar HTML', () => {
    const html = buildSolarSectionsHtml(
      makeSolar(),
      [service('<img src=x onerror=alert(1)>', 1, 100)],
      totals(),
    );

    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });
});
