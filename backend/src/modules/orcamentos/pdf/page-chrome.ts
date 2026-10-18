import { CompanySettingsDocument } from '../schemas/company-settings.schema';
import { OSF_LOGO_BASE64 } from './osf-logo-base64';
import { escapeHtml } from './format';

/**
 * Cabeçalho e rodapé repetidos em toda página, via `displayHeaderFooter` do Puppeteer.
 *
 * Por que não um `position: fixed` no HTML: o Chromium repete elementos fixos na impressão,
 * mas eles passam por cima do conteúdo em vez de reservar espaço, e o texto da última linha
 * de cada página fica escondido atrás do rodapé. A margem de página + template resolve isso
 * de forma que o conteúdo nunca colide.
 *
 * O template é renderizado num documento isolado: ele não herda o `<style>` da página, todo
 * CSS precisa ser inline, e imagem só entra como data URI.
 */

/** Margens da página. O topo e a base abrem espaço para o cabeçalho e o rodapé. */
export const PAGE_MARGIN = {
  top: '22mm',
  bottom: '16mm',
  left: '14mm',
  right: '14mm',
} as const;

const BASE = 'font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact;';

export function buildHeaderTemplate(company: CompanySettingsDocument, budgetNumber: string): string {
  return `<div style="${BASE} width: 100%; padding: 0 14mm; box-sizing: border-box; font-size: 8px; color: #6B7280;">
    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #E5E7EB; padding-bottom: 5px;">
      <div style="display: flex; align-items: center; gap: 7px; min-width: 0;">
        <img src="data:image/png;base64,${OSF_LOGO_BASE64}" style="height: 16px; width: 16px; object-fit: contain;" />
        <span style="font-size: 8.5px; font-weight: bold; color: #14345F; letter-spacing: 0.3px; text-transform: uppercase;">
          ${escapeHtml(company.companyName)}
        </span>
      </div>
      <span style="font-size: 8px; color: #9CA3AF; letter-spacing: 1px; text-transform: uppercase;">
        Orçamento Nº ${escapeHtml(budgetNumber)}
      </span>
    </div>
  </div>`;
}

export function buildFooterTemplate(company: CompanySettingsDocument): string {
  const contacts = [company.phone, company.email, company.instagram]
    .filter(Boolean)
    .map((value) => escapeHtml(value as string))
    .join(' · ');

  return `<div style="${BASE} width: 100%; padding: 0 14mm; box-sizing: border-box; font-size: 7.5px; color: #9CA3AF;">
    <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #E5E7EB; padding-top: 5px;">
      <span style="min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${contacts}</span>
      <span style="white-space: nowrap;">
        Página <span class="pageNumber"></span> de <span class="totalPages"></span>
      </span>
    </div>
  </div>`;
}
