const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Formata centavos como string BRL: 57969 → "R$ 579,69" */
export function formatCents(cents: number): string {
  return BRL.format(cents / 100);
}

/** Número real → centavos inteiros: 579.69 → 57969 */
export function toCents(value: number): number {
  return Math.round(value * 100);
}

/** Centavos → número real: 57969 → 579.69 */
export function fromCents(cents: number): number {
  return cents / 100;
}

const MAX_CENTS = 99_999_999_99; // R$ 999.999.999,99

/** Acumula um dígito à direita: 5796 + 9 → 57969 */
export function appendDigit(cents: number, digit: number): number {
  const next = cents * 10 + digit;
  return next > MAX_CENTS ? cents : next;
}

/** Remove o último dígito: 57969 → 5796 */
export function removeDigit(cents: number): number {
  return Math.floor(cents / 10);
}
