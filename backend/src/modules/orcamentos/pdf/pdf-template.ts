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

// O PDF é renderizado no fuso do servidor (UTC na Vercel). Sem fixar o fuso aqui, a hora de
// emissão sairia 3h adiantada para quem lê o documento.
export const APP_TIME_ZONE = 'America/Fortaleza';

/** Instante real (ex.: emissão) — convertido para o fuso da empresa. */
const formatDate = (value?: Date) =>
  value ? new Date(value).toLocaleDateString('pt-BR', { timeZone: APP_TIME_ZONE }) : '-';

/**
 * Data pura (ex.: validade), que o app grava à meia-noite UTC. Converter para o fuso da
 * empresa devolveria o dia anterior, então esta é lida em UTC de propósito.
 */
const formatDateOnly = (value?: Date) =>
  value ? new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-';

const formatTime = (value?: Date) =>
  value
    ? new Date(value).toLocaleTimeString('pt-BR', {
        timeZone: APP_TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

// Ícones do Lucide, a mesma família usada na interface, embutidos como SVG para não
// depender de fonte de ícones dentro do Chromium.
const ICON_CALENDAR =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
const ICON_CLOCK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';

/** Campo rotulado da grade de dados do cliente — omitido inteiro quando não há valor. */
const field = (label: string, value?: string, span = 1) =>
  value
    ? `<div class="field"${span > 1 ? ` style="grid-column: span ${span}"` : ''}>
         <span class="label">${label}</span>
         <span class="value">${escapeHtml(value)}</span>
       </div>`
    : '';

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

  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; border-bottom: 3px solid #F0AC28; padding-bottom: 16px; }
  header .brand { display: flex; align-items: flex-start; gap: 16px; }
  header .brand img { height: 64px; width: 64px; object-fit: contain; }
  h1 { font-size: 15px; margin: 0 0 5px; text-transform: uppercase; letter-spacing: 0.3px; }
  header .company div { font-size: 11.5px; color: #444444; line-height: 1.5; }

  /* Emissão: data e hora com ícone, alinhadas à direita */
  .issued { text-align: right; white-space: nowrap; }
  .issued .row { display: flex; align-items: center; justify-content: flex-end; gap: 5px; font-size: 12px; color: #444444; line-height: 1.7; }
  .issued svg { width: 12px; height: 12px; color: #8a8a8a; }
  .issued .valid { margin-top: 6px; font-size: 11px; color: #8a8a8a; }

  /* Dados do cliente em grade rotulada */
  .client { margin-top: 18px; padding: 14px 0; border-bottom: 1px solid #e5e5e5; }
  .client-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px 24px; }
  .client .field { display: flex; flex-direction: column; gap: 2px; }
  .client .label { font-size: 9.5px; color: #9a9a9a; letter-spacing: 0.4px; }
  .client .value { font-size: 12px; color: #111111; }
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
      <img src="data:image/png;base64,${OSF_LOGO_BASE64}" alt="${escapeHtml(company.companyName)}" />
      <div class="company">
        <h1>${escapeHtml(company.companyName)}</h1>
        ${company.cnpj ? `<div>CNPJ: ${escapeHtml(company.cnpj)}</div>` : ''}
        ${company.baseAddress ? `<div>${escapeHtml(company.baseAddress)}</div>` : ''}
        ${company.phone ? `<div>Telefone: ${escapeHtml(company.phone)}</div>` : ''}
        ${company.email ? `<div>E-mail: ${escapeHtml(company.email)}</div>` : ''}
        ${company.instagram ? `<div>Instagram: ${escapeHtml(company.instagram)}</div>` : ''}
      </div>
    </div>
    <div class="issued">
      <div class="row">${ICON_CALENDAR}${formatDate(budget.createdAt)}</div>
      <div class="row">${ICON_CLOCK}${formatTime(budget.createdAt)}</div>
      <div class="valid">Válido até ${formatDateOnly(budget.validUntil)}</div>
    </div>
  </header>

  <section class="client">
    <div class="client-grid">
      ${field('Cliente', client.name)}
      ${field('Telefone', client.phone)}
      ${field('E-mail', client.email)}
      ${field('Endereço', client.address, 3)}
    </div>
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
