/**
 * Nome do arquivo PDF de um orçamento: `<cliente-em-slug>_<DD-MM-AA>` (ex.: `azuos-dev_18-08-26`).
 *
 * A data sai em UTC de propósito: o cabeçalho do PDF é renderizado no fuso do servidor
 * (UTC na Vercel), então usar a mesma base evita que o nome do arquivo e a data impressa
 * no documento discordem em um dia.
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

  const date = createdAt ? new Date(createdAt) : new Date();
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = String(date.getUTCFullYear()).slice(-2);

  return `${slug || 'cliente'}_${day}-${month}-${year}`;
}
