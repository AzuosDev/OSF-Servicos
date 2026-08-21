import { APP_TIME_ZONE } from './pdf-template';

/**
 * Nome do arquivo PDF de um orçamento: `<cliente-em-slug>_<DD-MM-AA>` (ex.: `azuos-dev_18-08-26`).
 *
 * A data é lida no fuso da empresa (o mesmo usado no cabeçalho do PDF), e não no fuso do
 * servidor — assim o nome do arquivo e a data impressa no documento nunca discordam.
 *
 * A mesma regra é reproduzida no frontend, em `frontend/src/lib/orcamentos.ts`, que nomeia
 * o download na listagem de orçamentos — alterar uma exige alterar a outra.
 */
export function budgetPdfFileName(clientName: string, createdAt?: Date): string {
  const slug = clientName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // en-CA formata como YYYY-MM-DD, o que dá as partes já no fuso pedido.
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(createdAt ? new Date(createdAt) : new Date())
    .split('-');

  return `${slug || 'cliente'}_${day}-${month}-${year.slice(-2)}`;
}
