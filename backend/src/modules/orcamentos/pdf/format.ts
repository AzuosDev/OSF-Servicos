/**
 * Formatadores compartilhados pelo template do PDF e pelas seções do orçamento solar.
 *
 * Vivem num módulo próprio para que as seções solares não precisem importar do template
 * que as inclui — o ciclo de import funcionaria por acidente e quebraria na primeira
 * reordenação.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Número com separador de milhar e casas fixas — usado em kWh e potência. */
export const formatNumber = (value: number, decimals = 0) =>
  value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** "3 anos e 6 meses", "2 anos", "7 meses" — nunca "3.5 anos". */
export function formatPaybackPeriod(totalMonths: number): string {
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'ano' : 'anos'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'mês' : 'meses'}`);

  return parts.length > 0 ? parts.join(' e ') : '—';
}

/** Anos de garantia, omitindo o campo quando a empresa não configurou o prazo. */
export const formatYears = (years?: number) =>
  years == null ? undefined : `${years} ${years === 1 ? 'ano' : 'anos'}`;
