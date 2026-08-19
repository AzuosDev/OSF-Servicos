import { BudgetDocument } from '../schemas/budget.schema';
import { ClientDocument } from '../schemas/client.schema';
import { CompanySettingsDocument } from '../schemas/company-settings.schema';
import { OSF_LOGO_BASE64 } from './osf-logo-base64';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDate = (value?: Date) => (value ? new Date(value).toLocaleDateString('pt-BR') : '-');

export function buildBudgetHtml(
  budget: BudgetDocument,
  client: ClientDocument,
  company: CompanySettingsDocument,
): string {
  const itemsRows = budget.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td class="right">${item.quantity}</td>
          <td class="right">${formatCurrency(item.unitPrice)}</td>
          <td class="right">${formatCurrency(item.subtotal)}</td>
        </tr>`,
    )
    .join('');

  const travelRow =
    budget.travelCost > 0
      ? `<tr><td colspan="3">Deslocamento</td><td class="right">${formatCurrency(budget.travelCost)}</td></tr>`
      : '';

  const discountRow =
    budget.discount > 0
      ? `<tr><td colspan="3">Desconto</td><td class="right">-${formatCurrency(budget.discount)}</td></tr>`
      : '';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: Arial, sans-serif; color: #111111; margin: 40px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #F0AC28; padding-bottom: 16px; }
  header .brand { display: flex; align-items: center; gap: 14px; }
  header .brand img { height: 48px; width: 48px; object-fit: contain; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  th, td { padding: 8px; border-bottom: 1px solid #e5e5e5; text-align: left; font-size: 13px; }
  th { background: #f5f5f5; }
  .right { text-align: right; }
  .total-row td { font-weight: bold; font-size: 15px; border-top: 2px solid #111111; }
  footer { margin-top: 32px; font-size: 11px; color: #666; }
</style>
</head>
<body>
  <header>
    <div class="brand">
      <img src="data:image/png;base64,${OSF_LOGO_BASE64}" alt="OSF Serviços" />
      <div>
        <h1>${escapeHtml(company.companyName)}</h1>
        ${company.baseAddress ? `<div>${escapeHtml(company.baseAddress)}</div>` : ''}
        ${company.phone ? `<div>${escapeHtml(company.phone)}</div>` : ''}
      </div>
    </div>
    <div>
      <div>Data: ${formatDate(budget.createdAt)}</div>
      <div>Válido até: ${formatDate(budget.validUntil)}</div>
    </div>
  </header>

  <section>
    <h2>Cliente</h2>
    <div>${escapeHtml(client.name)}</div>
    <div>${escapeHtml(client.address)}</div>
    ${client.phone ? `<div>${escapeHtml(client.phone)}</div>` : ''}
  </section>

  <table>
    <thead>
      <tr><th>Serviço</th><th class="right">Qtd</th><th class="right">Valor unit.</th><th class="right">Subtotal</th></tr>
    </thead>
    <tbody>
      ${itemsRows}
      ${travelRow}
      ${discountRow}
      <tr class="total-row"><td colspan="3">Total</td><td class="right">${formatCurrency(budget.total)}</td></tr>
    </tbody>
  </table>

  ${budget.notes ? `<section><h2>Observações</h2><div>${escapeHtml(budget.notes)}</div></section>` : ''}

  <footer>
    ${company.pdfFooterNote ? escapeHtml(company.pdfFooterNote) : ''}
  </footer>
</body>
</html>`;
}
