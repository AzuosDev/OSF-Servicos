import { SolarDetails, SolarInverterType } from '../schemas/solar-details.schema';
import { MONTH_LABELS } from '../solar/solar-calculations';
import { escapeHtml, formatCurrency, formatNumber, formatPaybackPeriod, formatYears } from './format';

/**
 * Seções exclusivas do orçamento de venda de sistema fotovoltaico: equipamentos, geração,
 * garantias, indicadores financeiros e economia.
 *
 * Toda seção é omitida inteira quando não há dado para ela — o mesmo princípio dos contatos
 * no cabeçalho. Um orçamento criado sem irradiação sai sem o bloco de geração em vez de sair
 * com um gráfico vazio, e uma garantia não configurada simplesmente não aparece.
 */

const CHART_WIDTH = 720;
const CHART_HEIGHT = 200;
const CHART_PADDING_LEFT = 44;
const CHART_PADDING_RIGHT = 8;
const CHART_PADDING_TOP = 16;
const CHART_PADDING_BOTTOM = 28;

const inverterLabel = (type: SolarInverterType) =>
  type === SolarInverterType.MICROINVERSOR ? 'Microinversor' : 'Inversor';

/** Linha rotulada de um painel de indicadores; omitida inteira quando não há valor. */
const indicator = (label: string, value?: string) =>
  value
    ? `<div class="indicator">
         <span class="indicator-label">${escapeHtml(label)}</span>
         <span class="indicator-value">${escapeHtml(value)}</span>
       </div>`
    : '';

/**
 * Gráfico de colunas da geração mês a mês, em SVG puro.
 *
 * SVG e não uma biblioteca de gráficos porque o HTML é renderizado dentro do Chromium sem
 * rede: qualquer script externo simplesmente não carregaria, e a página sairia sem o gráfico.
 */
export function buildGenerationChartSvg(monthly: { month: number; kwh: number }[]): string {
  if (monthly.length === 0) return '';

  const plotWidth = CHART_WIDTH - CHART_PADDING_LEFT - CHART_PADDING_RIGHT;
  const plotHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;

  // Escala a partir do maior mês, nunca de zero — senão uma geração toda igual sumiria.
  const maxKwh = Math.max(...monthly.map((m) => m.kwh), 1);
  const slotWidth = plotWidth / monthly.length;
  const barWidth = slotWidth * 0.62;

  const bars = monthly
    .map((item, index) => {
      const barHeight = Math.max((item.kwh / maxKwh) * plotHeight, 0);
      const x = CHART_PADDING_LEFT + index * slotWidth + (slotWidth - barWidth) / 2;
      const y = CHART_PADDING_TOP + plotHeight - barHeight;
      const label = MONTH_LABELS[item.month - 1] ?? '';

      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(
        1,
      )}" fill="#F0AC28" rx="2" />
      <text x="${(x + barWidth / 2).toFixed(1)}" y="${(y - 4).toFixed(
        1,
      )}" text-anchor="middle" font-size="8" fill="#666666">${formatNumber(item.kwh)}</text>
      <text x="${(x + barWidth / 2).toFixed(1)}" y="${(CHART_PADDING_TOP + plotHeight + 14).toFixed(
        1,
      )}" text-anchor="middle" font-size="9" fill="#444444">${escapeHtml(label)}</text>`;
    })
    .join('');

  // Três linhas de grade com o valor em kWh à esquerda, para o cliente ler a altura.
  const gridLines = [0, 0.5, 1]
    .map((fraction) => {
      const y = CHART_PADDING_TOP + plotHeight - fraction * plotHeight;
      return `<line x1="${CHART_PADDING_LEFT}" y1="${y.toFixed(1)}" x2="${CHART_WIDTH - CHART_PADDING_RIGHT}" y2="${y.toFixed(
        1,
      )}" stroke="#e5e5e5" stroke-width="1" />
      <text x="${CHART_PADDING_LEFT - 6}" y="${(y + 3).toFixed(
        1,
      )}" text-anchor="end" font-size="8" fill="#9a9a9a">${formatNumber(maxKwh * fraction)}</text>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" width="100%" role="img" aria-label="Geração estimada mês a mês em kWh">
    ${gridLines}
    ${bars}
  </svg>`;
}

function buildEquipmentRows(solar: SolarDetails): string {
  const panelRows = solar.panels
    .map(
      (panel) => `
        <tr>
          <td>${escapeHtml(panel.model ? `Painel solar ${panel.model}` : 'Painel solar')}</td>
          <td class="right">${panel.quantity}</td>
          <td class="right">${formatNumber(panel.wattagePeak)} Wp</td>
        </tr>`,
    )
    .join('');

  const inverterRows = solar.inverters
    .map((inverter) => {
      const name = inverter.model
        ? `${inverterLabel(inverter.type)} ${inverter.model}`
        : inverterLabel(inverter.type);
      return `
        <tr>
          <td>${escapeHtml(name)}</td>
          <td class="right">${inverter.quantity}</td>
          <td class="right">${inverter.wattage != null ? `${formatNumber(inverter.wattage)} W` : '—'}</td>
        </tr>`;
    })
    .join('');

  return panelRows + inverterRows;
}

/** Tabela de equipamentos — substitui a tabela de serviços no orçamento solar. */
export function buildSolarEquipmentTable(solar: SolarDetails, travelCost: number, discount: number, total: number): string {
  const travelRow =
    travelCost > 0
      ? `<tr><td colspan="2">Deslocamento</td><td class="right">${formatCurrency(travelCost)}</td></tr>`
      : '';

  const discountRow =
    discount > 0 ? `<tr><td colspan="2">Desconto</td><td class="right">-${formatCurrency(discount)}</td></tr>` : '';

  return `<table>
    <thead>
      <tr><th>Equipamento</th><th class="right">Qtd</th><th class="right">Potência</th></tr>
    </thead>
    <tbody>
      ${buildEquipmentRows(solar)}
      <tr><td colspan="2">Sistema</td><td class="right">${formatCurrency(solar.financials.investment)}</td></tr>
      ${travelRow}
      ${discountRow}
      <tr class="total-row"><td colspan="2">Total</td><td class="right">${formatCurrency(total)}</td></tr>
    </tbody>
  </table>`;
}

function buildGenerationSection(solar: SolarDetails): string {
  const generation = solar.generation;
  if (!generation) return '';

  return `<section class="solar-section">
    <h2>Geração de energia estimada</h2>
    <div class="indicator-grid">
      ${indicator('Potência do sistema', `${formatNumber(generation.systemPowerKwp, 2)} kWp`)}
      ${indicator('Média semanal', `${formatNumber(generation.averageWeeklyKwh)} kWh`)}
      ${indicator('Média mensal', `${formatNumber(generation.averageMonthlyKwh)} kWh`)}
      ${indicator('Total no ano', `${formatNumber(generation.annualKwh)} kWh`)}
    </div>
    <div class="chart">${buildGenerationChartSvg(generation.monthly)}</div>
    <p class="note">
      Variação ao longo do ano calculada a partir da irradiação solar média da localidade do cliente.
    </p>
  </section>`;
}

function buildWarrantiesSection(solar: SolarDetails): string {
  const { panelEfficiencyYears, panelDefectYears, inverterYears, installationYears } = solar.warranties;

  const rows = [
    indicator('Painel — eficiência', formatYears(panelEfficiencyYears)),
    indicator('Painel — defeito de fabricação', formatYears(panelDefectYears)),
    indicator('Inversor / microinversor', formatYears(inverterYears)),
    indicator('Instalação', formatYears(installationYears)),
  ].join('');

  // Empresa que não configurou garantia nenhuma não ganha uma seção vazia no PDF.
  if (!rows.trim()) return '';

  return `<section class="solar-section">
    <h2>Garantias do sistema</h2>
    <div class="indicator-grid">${rows}</div>
  </section>`;
}

function buildFinancialSection(solar: SolarDetails): string {
  const { investment, irrPercent, paybackMonths } = solar.financials;

  return `<section class="solar-section">
    <h2>Indicadores financeiros</h2>
    <div class="indicator-grid">
      ${indicator('Valor do investimento', formatCurrency(investment))}
      ${indicator('T.I.R. (ao ano)', irrPercent != null ? `${formatNumber(irrPercent, 2)}%` : undefined)}
      ${indicator('Payback', paybackMonths != null ? formatPaybackPeriod(paybackMonths) : undefined)}
    </div>
  </section>`;
}

function buildSavingsSection(solar: SolarDetails): string {
  const { currentMonthlyBill, projectedMonthlyBill, monthlySavings, annualSavings, totalSavings, horizonYears } =
    solar.financials;

  return `<section class="solar-section">
    <h2>Economia estimada</h2>
    <div class="bill-flow">
      <div class="bill">
        <span class="bill-label">Fatura mensal atual</span>
        <span class="bill-value">${formatCurrency(currentMonthlyBill)}</span>
      </div>
      <div class="bill-arrow">&#8594;</div>
      <div class="bill bill-after">
        <span class="bill-label">Com o sistema instalado</span>
        <span class="bill-value">${formatCurrency(projectedMonthlyBill)}</span>
      </div>
    </div>
    <div class="indicator-grid">
      ${indicator('Economia mensal', formatCurrency(monthlySavings))}
      ${indicator('Economia por ano', formatCurrency(annualSavings))}
      ${indicator(`Economia em ${horizonYears} anos`, formatCurrency(totalSavings))}
    </div>
  </section>`;
}

/** Todas as seções solares, na ordem em que aparecem no documento. */
export function buildSolarSectionsHtml(solar: SolarDetails): string {
  return [
    buildGenerationSection(solar),
    buildWarrantiesSection(solar),
    buildFinancialSection(solar),
    buildSavingsSection(solar),
  ].join('');
}

/** CSS das seções solares, embutido no `<style>` do template. */
export const SOLAR_SECTION_STYLES = `
  .solar-section { margin-top: 26px; page-break-inside: avoid; }
  .solar-section h2 { font-size: 13px; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 0.4px; color: #111111; border-bottom: 2px solid #F0AC28; padding-bottom: 5px; }

  .indicator-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px 18px; }
  .indicator { display: flex; flex-direction: column; gap: 2px; }
  .indicator-label { font-size: 9.5px; color: #9a9a9a; letter-spacing: 0.4px; }
  .indicator-value { font-size: 13px; color: #111111; font-weight: bold; }

  .chart { margin-top: 14px; }
  .solar-section .note { font-size: 10px; color: #8a8a8a; margin: 6px 0 0; }

  .bill-flow { display: flex; align-items: center; gap: 16px; margin-bottom: 14px; }
  .bill { flex: 1; padding: 10px 14px; background: #f5f5f5; border-radius: 6px; display: flex; flex-direction: column; gap: 3px; }
  .bill-after { background: #fdf4e3; border: 1px solid #F0AC28; }
  .bill-label { font-size: 9.5px; color: #8a8a8a; letter-spacing: 0.4px; }
  .bill-value { font-size: 16px; font-weight: bold; color: #111111; }
  .bill-arrow { font-size: 20px; color: #F0AC28; }
`;
