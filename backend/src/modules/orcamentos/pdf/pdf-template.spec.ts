import { buildBudgetHtml, escapeHtml } from './pdf-template';
import { BudgetStatus } from '../schemas/budget.schema';

describe('escapeHtml', () => {
  it('escapes html-significant characters', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(escapeHtml(`"quoted" & 'single'`)).toBe('&quot;quoted&quot; &amp; &#39;single&#39;');
  });
});

describe('buildBudgetHtml', () => {
  const budget: any = {
    sequenceNumber: 7,
    createdAt: new Date('2026-01-10T00:00:00.000Z'),
    validUntil: new Date('2026-01-17T00:00:00.000Z'),
    items: [{ name: 'Instalação de painel solar', quantity: 2, unitPrice: 500, subtotal: 1000 }],
    travelCost: 50,
    discount: 20,
    total: 1030,
    notes: 'Cliente pediu orçamento com <b>urgência</b>',
  };
  const client: any = { name: '<script>alert(1)</script>', address: 'Rua Teste, 123', phone: '11999999999', email: 'cliente@teste.com' };
  const company: any = {
    companyName: 'OSF Serviços',
    baseAddress: 'Rua Empresa, 1',
    phone: '88 9688-6607',
    email: 'osfenergia.solucoes@gmail.com',
    instagram: '@osf_servicos',
    pdfFooterNote: 'Contato: contato@osf.com',
  };

  it('escapes an unsafe client name instead of injecting it raw', () => {
    const html = buildBudgetHtml(budget, client, company);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('includes the items and totals', () => {
    const html = buildBudgetHtml(budget, client, company);
    expect(html).toContain('Instalação de painel solar');
    expect(html).toContain('R$');
  });

  it('does not print the budget sequence number in the header', () => {
    const html = buildBudgetHtml(budget, client, company);
    expect(html).not.toContain('#0007');
    expect(html).not.toContain('Orçamento #');
  });

  it('prints the company contact details in the header', () => {
    const html = buildBudgetHtml(budget, client, company);
    expect(html).toContain('Telefone: 88 9688-6607');
    expect(html).toContain('E-mail: osfenergia.solucoes@gmail.com');
    expect(html).toContain('Instagram: @osf_servicos');
  });

  it('omits each contact line that is not filled in', () => {
    const companyNoContacts: any = { ...company, phone: '', email: '', instagram: '' };
    const html = buildBudgetHtml(budget, client, companyNoContacts);
    expect(html).not.toContain('Telefone:');
    expect(html).not.toContain('E-mail:');
    expect(html).not.toContain('Instagram:');
  });

  it('stamps the issue date and time in the company timezone, not the server one', () => {
    // 12:32 UTC é 09:32 em Fortaleza — o PDF roda em UTC na Vercel e sairia 3h adiantado.
    const issued: any = { ...budget, createdAt: new Date('2026-08-21T12:32:00.000Z') };
    const html = buildBudgetHtml(issued, client, company);
    expect(html).toContain('21/08/2026');
    expect(html).toContain('09:32');
  });

  it('reads validUntil in UTC, since it is a date stored at UTC midnight', () => {
    // Lida em Fortaleza, a meia-noite UTC de 28/08 viraria 27/08.
    const dated: any = { ...budget, validUntil: new Date('2026-08-28T00:00:00.000Z') };
    expect(buildBudgetHtml(dated, client, company)).toContain('Válido até 28/08/2026');
  });

  it('lays the client data out as labelled fields', () => {
    const html = buildBudgetHtml(budget, client, company);
    for (const label of ['Cliente', 'Telefone', 'Endereço']) {
      expect(html).toContain(`<span class="label">${label}</span>`);
    }
  });

  it('omits a client field that has no value instead of printing an empty label', () => {
    const withoutPhone: any = { ...client, phone: '' };
    const html = buildBudgetHtml(budget, withoutPhone, company);
    expect(html).not.toContain('<span class="label">Telefone</span>');
  });

  it('escapes notes even though they may contain unsafe html', () => {
    const html = buildBudgetHtml(budget, client, company);
    expect(html).toContain('&lt;b&gt;urgência&lt;/b&gt;');
  });

  it('omits the travel/discount rows when they are zero', () => {
    const budgetNoExtras: any = { ...budget, travelCost: 0, discount: 0 };
    const html = buildBudgetHtml(budgetNoExtras, client, company);
    expect(html).not.toContain('Deslocamento');
    expect(html).not.toContain('Desconto');
  });
});

describe('buildBudgetHtml for a solar budget', () => {
  const solarBudget: any = {
    sequenceNumber: 8,
    type: 'SOLAR',
    createdAt: new Date('2026-01-10T00:00:00.000Z'),
    validUntil: new Date('2026-01-17T00:00:00.000Z'),
    items: [],
    travelCost: 0,
    discount: 0,
    total: 30000,
    solar: {
      panels: [{ quantity: 12, wattagePeak: 550, model: 'Canadian 550W' }],
      inverters: [{ quantity: 1, type: 'INVERSOR', model: 'Growatt 6kW', wattage: 6000 }],
      warranties: { panelEfficiencyYears: 25, panelDefectYears: 12, inverterYears: 10, installationYears: 5 },
      generation: {
        systemPowerKwp: 6.6,
        performanceRatio: 0.78,
        monthly: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, kwh: 800 + i * 10 })),
        annualKwh: 10260,
        averageMonthlyKwh: 855,
        averageWeeklyKwh: 197.31,
        monthlyIrradiance: Array<number>(12).fill(5.5),
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
    },
  };

  const client: any = { name: 'Cliente Solar', address: 'Rua Teste, 123' };
  const company: any = { companyName: 'OSF Serviços', baseAddress: 'Rua Empresa, 1' };

  it('replaces the services table with the equipment table', () => {
    const html = buildBudgetHtml(solarBudget, client, company);

    expect(html).toContain('Equipamento');
    expect(html).toContain('Painel solar Canadian 550W');
    expect(html).not.toContain('<th>Serviço</th>');
  });

  it('adds the solar sections and the inline generation chart', () => {
    const html = buildBudgetHtml(solarBudget, client, company);

    expect(html).toContain('Geração de energia estimada');
    expect(html).toContain('Garantias do sistema');
    expect(html).toContain('Indicadores financeiros');
    expect(html).toContain('Economia estimada');
    expect(html).toContain('Geração estimada mês a mês');
  });

  it('keeps the shared header, client block and footer identical to a services budget', () => {
    const html = buildBudgetHtml(solarBudget, client, company);

    expect(html).toContain('OSF Serviços');
    expect(html).toContain('Cliente Solar');
    expect(html).toContain('Válido até');
  });

  // Orçamento gravado antes desta funcionalidade não tem `type` nem `solar`.
  it('renders a legacy budget with no type as a services budget', () => {
    const legacy: any = { ...solarBudget, type: undefined, solar: undefined, items: [] };
    const html = buildBudgetHtml(legacy, client, company);

    expect(html).toContain('<th>Serviço</th>');
    expect(html).not.toContain('Geração de energia estimada');
  });

  // Fase 2 cria o orçamento sem geração quando a irradiação não pôde ser obtida — o PDF
  // precisa sair assim mesmo, sem a seção, em vez de quebrar.
  it('prints the document without the generation section when there is no generation', () => {
    const withoutGeneration: any = {
      ...solarBudget,
      solar: { ...solarBudget.solar, generation: undefined },
    };
    const html = buildBudgetHtml(withoutGeneration, client, company);

    expect(html).toContain('Indicadores financeiros');
    expect(html).not.toContain('Geração de energia estimada');
    // Checa o gráfico pelo rótulo dele, não por "<svg": os ícones de calendário e relógio
    // do cabeçalho também são SVG e estão presentes em todo orçamento.
    expect(html).not.toContain('Geração estimada mês a mês');
  });
});

describe('page margins', () => {
  const client: any = { name: 'Cliente', address: 'Rua Teste, 123' };
  const company: any = { companyName: 'OSF Serviços', baseAddress: 'Rua Empresa, 1' };
  const budget: any = {
    sequenceNumber: 1, type: 'SERVICOS', createdAt: new Date(), items: [],
    travelCost: 0, discount: 0, total: 100,
  };

  /**
   * Regressão: uma regra `@page { margin: 0 }` no CSS sobrepõe a margem passada em
   * `page.pdf()`. O sintoma é conteúdo colado na borda da folha e o cabeçalho/rodapé
   * impressos por cima do texto — foi exatamente o que saiu no PDF de produção.
   */
  it('never declares a zero page margin in CSS, which would override the Puppeteer margin', () => {
    const html = buildBudgetHtml(budget, client, company);
    const pageRules = html.match(/@page[^}]*}/g) ?? [];

    for (const rule of pageRules) {
      expect(rule).not.toMatch(/margin\s*:\s*0/);
    }
  });

  it('keeps headings from being orphaned at the bottom of a page', () => {
    const html = buildBudgetHtml(budget, client, company);
    expect(html).toContain('page-break-after: avoid');
  });

  it('never splits a table row across two pages', () => {
    const html = buildBudgetHtml(budget, client, company);
    expect(html).toContain('tr { break-inside: avoid');
  });
});

describe('serviços adicionais na venda solar', () => {
  const client: any = { name: 'Cliente Solar', address: 'Rua Teste, 123' };
  const company: any = { companyName: 'OSF Serviços', baseAddress: 'Rua Empresa, 1' };

  const solarBudget = (items: any[]): any => ({
    sequenceNumber: 9,
    type: 'SOLAR',
    createdAt: new Date('2026-01-10T00:00:00.000Z'),
    validUntil: new Date('2026-01-17T00:00:00.000Z'),
    items,
    travelCost: 0,
    discount: 0,
    total: 31200,
    notes: 'Instalação em telhado cerâmico.',
    solar: {
      panels: [{ quantity: 12, wattagePeak: 550 }],
      inverters: [{ quantity: 1, type: 'INVERSOR' }],
      warranties: { inverterYears: 10 },
      financials: {
        investment: 30000,
        currentMonthlyBill: 850,
        projectedMonthlyBill: 120,
        monthlySavings: 730,
        annualSavings: 8760,
        horizonYears: 25,
        totalSavings: 219000,
      },
    },
  });

  const items = [{ name: 'Instalação de padrão', quantity: 1, unitPrice: 1200, subtotal: 1200 }];

  // A ordem foi pedida assim: a proposta convence antes de listar o que mais será cobrado.
  it('imprime os serviços depois da economia estimada e antes das observações', () => {
    const html = buildBudgetHtml(solarBudget(items), client, company);

    const savings = html.indexOf('Economia estimada');
    const services = html.indexOf('Serviços adicionais');
    // O título, não a palavra: "Observações" também aparece num comentário do CSS.
    const notes = html.indexOf('<h2>Observações</h2>');

    expect(savings).toBeGreaterThan(-1);
    expect(services).toBeGreaterThan(savings);
    expect(notes).toBeGreaterThan(services);
  });

  it('fecha a listagem com o total de sistema + serviços', () => {
    const html = buildBudgetHtml(solarBudget(items), client, company);
    const section = html.slice(html.indexOf('Serviços adicionais'));

    expect(section).toContain('Instalação de padrão');
    expect(section).toContain('R$ 31.200,00');
  });

  // Sem serviços adicionais o documento tem que sair idêntico ao que já saía.
  it('não muda o orçamento solar sem serviços adicionais', () => {
    const html = buildBudgetHtml(solarBudget([]), client, company);

    expect(html).not.toContain('Serviços adicionais');
    expect(html).toContain('R$ 31.200,00'); // total segue no fim dos equipamentos
  });

  it('não imprime equipamento solar na tabela de serviços adicionais', () => {
    const html = buildBudgetHtml(solarBudget(items), client, company);
    const section = html.slice(html.indexOf('Serviços adicionais'));

    expect(section).not.toContain('Painel solar');
  });
});

describe('cover page', () => {
  const client: any = { name: 'Cliente Solar', address: 'Rua Teste, 123' };
  const company: any = { companyName: 'OSF Serviços', baseAddress: 'Rua Empresa, 1' };

  const solarBudget: any = {
    sequenceNumber: 8,
    type: 'SOLAR',
    createdAt: new Date('2026-01-10T00:00:00.000Z'),
    validUntil: new Date('2026-01-17T00:00:00.000Z'),
    items: [],
    travelCost: 0,
    discount: 0,
    total: 30000,
    solar: {
      panels: [{ quantity: 12, wattagePeak: 550 }],
      inverters: [{ quantity: 1, type: 'INVERSOR' }],
      warranties: {},
      generation: {
        systemPowerKwp: 6.6,
        performanceRatio: 0.78,
        monthly: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, kwh: 800 })),
        annualKwh: 9600,
        averageMonthlyKwh: 800,
        averageWeeklyKwh: 184.6,
        monthlyIrradiance: Array(12).fill(5.5),
      },
      financials: {
        investment: 30000,
        currentMonthlyBill: 850,
        projectedMonthlyBill: 120,
        monthlySavings: 730,
        annualSavings: 8760,
        horizonYears: 25,
        totalSavings: 219000,
      },
    },
  };

  it('opens the solar proposal with a cover carrying the brand and the key figures', () => {
    const html = buildBudgetHtml(solarBudget, client, company);

    expect(html).toContain('class="cover"');
    expect(html).toContain('Proposta comercial');
    expect(html).toContain('class="cover-company">Proposta<');
    expect(html).toContain('Nº 0008');
    expect(html).toContain('6,60 kWp');
  });

  // A logo é o elemento principal da capa; um ajuste que a encolha de volta tem que doer.
  it('gives the logo roughly a third of the sheet', () => {
    const html = buildBudgetHtml(solarBudget, client, company);
    const plate = html.match(/\.cover-logo-plate \{[^}]*height:\s*(\d+)mm/);

    expect(plate).not.toBeNull();
    expect(Number(plate![1]) / 297).toBeGreaterThan(0.25);
  });

  it('breaks the page after the cover so the content starts on a fresh sheet', () => {
    const html = buildBudgetHtml(solarBudget, client, company);
    expect(html).toContain('page-break-after: always');
  });

  // Serviços é documento de uma página: uma capa ali seria cerimônia sem função.
  it('gives a services budget no cover', () => {
    const services: any = { ...solarBudget, type: 'SERVICOS', solar: undefined, items: [] };
    const html = buildBudgetHtml(services, client, company);

    expect(html).not.toContain('class="cover"');
    expect(html).not.toContain('Proposta comercial');
  });

  it('omits a cover field that has no value instead of printing an empty label', () => {
    const noGeneration: any = { ...solarBudget, solar: { ...solarBudget.solar, generation: undefined } };
    const html = buildBudgetHtml(noGeneration, client, company);

    expect(html).toContain('class="cover"');
    expect(html).not.toContain('Potência do sistema</span>');
  });
});

describe('notes section', () => {
  const client: any = { name: 'Cliente', address: 'Rua Teste, 123' };
  const company: any = { companyName: 'OSF Serviços', baseAddress: 'Rua Empresa, 1' };

  // Antes as observações saíam numa <section> sem classe nenhuma, soltas no fim do
  // documento e sem estilo — é o defeito que motivou esta revisão.
  it('renders the notes inside a styled block', () => {
    const budget: any = {
      sequenceNumber: 1, type: 'SERVICOS', createdAt: new Date(), items: [],
      travelCost: 0, discount: 0, total: 100, notes: 'Primeira linha\nSegunda linha',
    };
    const html = buildBudgetHtml(budget, client, company);

    expect(html).toContain('class="notes"');
    expect(html).toContain('Observações');
  });

  it('keeps line breaks typed by the user', () => {
    const budget: any = {
      sequenceNumber: 1, type: 'SERVICOS', createdAt: new Date(), items: [],
      travelCost: 0, discount: 0, total: 100, notes: 'Linha 1\nLinha 2',
    };
    const html = buildBudgetHtml(budget, client, company);

    // `white-space: pre-wrap` no CSS preserva a quebra sem precisar de <br>.
    expect(html).toContain('white-space: pre-wrap');
    expect(html).toContain('Linha 1\nLinha 2');
  });

  it('omits the notes block entirely when there are no notes', () => {
    const budget: any = {
      sequenceNumber: 1, type: 'SERVICOS', createdAt: new Date(), items: [],
      travelCost: 0, discount: 0, total: 100,
    };
    expect(buildBudgetHtml(budget, client, company)).not.toContain('class="notes"');
  });
});

describe('BudgetStatus enum sanity', () => {
  it('has the expected statuses', () => {
    expect(Object.values(BudgetStatus)).toEqual([
      'RASCUNHO',
      'ENVIADO',
      'APROVADO',
      'REJEITADO',
      'EXPIRADO',
      'CANCELADO',
    ]);
  });
});
