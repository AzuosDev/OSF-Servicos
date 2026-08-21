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
