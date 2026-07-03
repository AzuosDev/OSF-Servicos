import { describe, expect, it } from 'vitest';
import { appendDigit, formatCents, fromCents, removeDigit, toCents } from './currency';

describe('toCents', () => {
  it('converte 579.69 → 57969', () => {
    expect(toCents(579.69)).toBe(57969);
  });
  it('converte 0 → 0', () => {
    expect(toCents(0)).toBe(0);
  });
  it('converte 1000 → 100000', () => {
    expect(toCents(1000)).toBe(100000);
  });
  it('lida com imprecisão de ponto flutuante: 0.1 + 0.2', () => {
    expect(toCents(0.1 + 0.2)).toBe(30); // Math.round evita 29.999...
  });
});

describe('fromCents', () => {
  it('57969 → 579.69 (não 57969)', () => {
    // Este é o caso exato do bug antigo: "57969" não pode virar o valor final
    expect(fromCents(57969)).toBe(579.69);
    expect(fromCents(57969)).not.toBe(57969);
  });
  it('0 → 0', () => {
    expect(fromCents(0)).toBe(0);
  });
  it('100 → 1.00', () => {
    expect(fromCents(100)).toBe(1);
  });
});

describe('toCents + fromCents: ida e volta', () => {
  const values = [1.0, 10.99, 100.5, 579.69, 1234.56, 99999.99];
  for (const v of values) {
    it(`${v} → cents → ${v}`, () => {
      expect(fromCents(toCents(v))).toBeCloseTo(v, 10);
    });
  }
});

describe('formatCents', () => {
  it('0 cents → contém "0,00"', () => {
    expect(formatCents(0)).toContain('0,00');
  });
  it('57969 cents → contém "579,69"', () => {
    expect(formatCents(57969)).toContain('579,69');
  });
  it('100000 cents → contém "1.000,00"', () => {
    expect(formatCents(100000)).toContain('1.000,00');
  });
});

describe('appendDigit (acumulação da direita para esquerda)', () => {
  it('sequência 1,0,0,0 → R$ 10,00', () => {
    let c = 0;
    c = appendDigit(c, 1); expect(fromCents(c)).toBe(0.01);
    c = appendDigit(c, 0); expect(fromCents(c)).toBe(0.10);
    c = appendDigit(c, 0); expect(fromCents(c)).toBe(1.00);
    c = appendDigit(c, 0); expect(fromCents(c)).toBe(10.00);
  });
  it('não ultrapassa o limite máximo', () => {
    const max = 99_999_999_99;
    expect(appendDigit(max, 9)).toBe(max); // valor mantido ao atingir limite
  });
});

describe('removeDigit (backspace)', () => {
  it('57969 → 5796 (remove o 9 da direita)', () => {
    expect(removeDigit(57969)).toBe(5796);
  });
  it('10 → 1', () => {
    expect(removeDigit(10)).toBe(1);
  });
  it('1 → 0', () => {
    expect(removeDigit(1)).toBe(0);
  });
  it('0 → 0 (não vai negativo)', () => {
    expect(removeDigit(0)).toBe(0);
  });
});

describe('caso específico do bug antigo: "R$ 579,69" nunca vira 57969', () => {
  it('extração de dígitos da display → fromCents → valor correto', () => {
    const display = 'R$ 579,69';
    // O que o input enxerga: apenas os dígitos do display
    const digits = display.replace(/\D/g, ''); // "57969"
    const cents = parseInt(digits, 10);        // 57969
    // O valor enviado ao backend via fromCents é 579.69, nunca 57969
    expect(fromCents(cents)).toBe(579.69);
    expect(fromCents(cents)).not.toBe(57969);
  });
});
