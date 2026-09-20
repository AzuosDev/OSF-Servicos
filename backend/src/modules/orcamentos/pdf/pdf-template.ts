import { BudgetDocument, BudgetType } from '../schemas/budget.schema';
import { ClientDocument } from '../schemas/client.schema';
import { CompanySettingsDocument } from '../schemas/company-settings.schema';
import { OSF_LOGO_BASE64 } from './osf-logo-base64';
import { escapeHtml, formatCurrency } from './format';
import { SOLAR_SECTION_STYLES, buildSolarEquipmentTable, buildSolarSectionsHtml } from './solar-sections';
import { COVER_STYLES, buildCoverHtml } from './cover';

export { escapeHtml };

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
  // Venda de sistema solar troca a tabela de serviços pela de equipamentos e ganha as seções
  // de geração, garantias e indicadores. O resto do documento — cabeçalho, cliente, rodapé —
  // é exatamente o mesmo nos dois tipos.
  const isSolar = budget.type === BudgetType.SOLAR && !!budget.solar;

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

  const servicesTable = `<table>
    <thead>
      <tr><th>Serviço</th><th class="right">Qtd</th><th class="right">Valor unit.</th><th class="right">Subtotal</th></tr>
    </thead>
    <tbody>
      ${itemsRows}
      ${travelRow}
      ${discountRow}
      <tr class="total-row"><td colspan="3">Total</td><td class="right">${formatCurrency(budget.total)}</td></tr>
    </tbody>
  </table>`;

  // Na venda solar os itens de catálogo são serviços adicionais, impressos depois da
  // economia estimada — não na tabela de equipamentos, que é só o sistema.
  const totals = { travelCost: budget.travelCost, discount: budget.discount, total: budget.total };
  const additionalServices = isSolar ? budget.items : [];

  const valuesTable =
    isSolar && budget.solar
      ? buildSolarEquipmentTable(budget.solar, totals, additionalServices.length > 0)
      : servicesTable;

  const solarSections =
    isSolar && budget.solar ? buildSolarSectionsHtml(budget.solar, additionalServices, totals) : '';

  // Capa só na venda solar: o orçamento de serviços cabe numa página, e uma capa nele seria
  // cerimônia sem função.
  const cover = isSolar
    ? buildCoverHtml(budget, client, company, formatDate(budget.createdAt), formatDateOnly(budget.validUntil))
    : '';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  /* Cores da marca: azul do painel solar e dourado da logo — os mesmos tokens do app. */
  :root { --navy: #14345F; --gold: #F0AC28; --ink: #111827; --muted: #6B7280; --line: #E5E7EB; }

  /* Sem regra @page aqui de propósito: declarar margin zero no CSS SOBREPÕE a margem que o
     Puppeteer define, e o resultado é conteúdo colado na borda da folha com o cabeçalho e o
     rodapé por cima do texto. Formato e margens vivem só nas opções de page.pdf(). */

  * { box-sizing: border-box; }

  /* Nunca deixar uma linha solta no fim ou no começo de uma página. */
  p, td, li { orphans: 3; widows: 3; }

  /* Um título no rodapé da página com o conteúdo na seguinte fica órfão. */
  h2 { break-after: avoid; page-break-after: avoid; }

  table { break-inside: auto; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  thead { display: table-header-group; }

  body {
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    color: #111827;
    background: #FFFFFF;
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* A margem real da página vem do Puppeteer; o corpo só cuida do ritmo interno. */
  header {
    display: flex; justify-content: space-between; align-items: flex-start; gap: 24px;
    border-bottom: 3px solid #F0AC28; padding-bottom: 14px;
  }
  header .brand { display: flex; align-items: flex-start; gap: 14px; }
  header .brand img { height: 56px; width: 56px; object-fit: contain; }
  h1 { font-size: 14px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.6px; color: #14345F; font-weight: 800; }
  header .company div { font-size: 10.5px; color: #6B7280; line-height: 1.55; }

  .issued { text-align: right; white-space: nowrap; }
  .issued .row { display: flex; align-items: center; justify-content: flex-end; gap: 5px; font-size: 11px; color: #4B5563; line-height: 1.7; }
  .issued svg { width: 11px; height: 11px; color: #9CA3AF; }
  .issued .valid { margin-top: 5px; font-size: 10px; color: #9CA3AF; }

  .client { margin-top: 16px; padding: 14px 16px; background: #F8F9FB; border-radius: 10px; border: 1px solid #EEF0F4; }
  .client-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px 24px; }
  .client .field { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .client .label { font-size: 8.5px; color: #9CA3AF; letter-spacing: 1.4px; text-transform: uppercase; font-weight: 600; }
  .client .value { font-size: 11.5px; color: #111827; font-weight: 500; word-break: break-word; }

  table { width: 100%; border-collapse: collapse; margin-top: 22px; }
  th, td { padding: 9px 10px; text-align: left; font-size: 11.5px; border-bottom: 1px solid #EEF0F4; }
  th {
    background: #14345F; color: #FFFFFF; font-size: 8.5px; letter-spacing: 1.4px;
    text-transform: uppercase; font-weight: 700; border-bottom: none;
  }
  th:first-child { border-top-left-radius: 8px; }
  th:last-child { border-top-right-radius: 8px; }
  tbody tr:nth-child(even) td { background: #FAFBFC; }
  .right { text-align: right; }
  .total-row td {
    font-weight: 800; font-size: 14px; color: #14345F;
    border-top: 2px solid #14345F; border-bottom: none; background: #FFFFFF !important;
  }

  /* Observações: antes era uma section sem estilo nenhum — saía solta no fim do documento. */
  .notes { margin-top: 26px; page-break-inside: avoid; break-inside: avoid; }
  .notes h2 {
    font-size: 12px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 1.4px;
    color: #14345F; font-weight: 800; border-bottom: 2px solid #F0AC28; padding-bottom: 5px;
  }
  .closing-note {
    margin-top: 22px; padding-top: 12px; border-top: 1px solid #EEF0F4;
    font-size: 10px; color: #9CA3AF; line-height: 1.6; white-space: pre-wrap;
    page-break-inside: avoid;
  }

  .notes p {
    margin: 0; padding: 12px 14px; background: #F8F9FB; border-left: 3px solid #F0AC28;
    border-radius: 0 8px 8px 0; font-size: 11px; line-height: 1.65; color: #374151;
    white-space: pre-wrap; overflow-wrap: anywhere;
  }
${SOLAR_SECTION_STYLES}
${COVER_STYLES}
</style>
</head>
<body>
  ${cover}

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

  ${valuesTable}

  ${solarSections}

  ${
    budget.notes
      ? `<section class="notes">
           <h2>Observações</h2>
           <p>${escapeHtml(budget.notes)}</p>
         </section>`
      : ''
  }

  ${
    company.pdfFooterNote
      ? `<footer class="closing-note">${escapeHtml(company.pdfFooterNote)}</footer>`
      : ''
  }
</body>
</html>`;
}
