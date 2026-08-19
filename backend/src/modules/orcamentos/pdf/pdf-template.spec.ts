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
  const client: any = { name: '<script>alert(1)</script>', address: 'Rua Teste, 123', phone: '11999999999' };
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

  it('keeps the creation and validity dates in the header', () => {
    const html = buildBudgetHtml(budget, client, company);
    expect(html).toContain('Data:');
    expect(html).toContain('Válido até:');
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
