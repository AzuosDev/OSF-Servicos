import { describe, expect, it } from "vitest";
import {
  SEVEN_DAYS_MS,
  resolveSuggestionCheck,
  resolveShowModal,
} from "./webauthn-suggestion";

const NOW = 1_700_000_000_000;

describe("resolveSuggestionCheck", () => {
  it("Forma 1: shouldCheck=true + isForm1=true quando a flag de tentativa está setada", () => {
    expect(
      resolveSuggestionCheck({ browserSupports: true, triedFlag: "tried", dismissedAt: null, now: NOW }),
    ).toEqual({ shouldCheck: true, isForm1: true });
  });

  it("Forma 1 tem prioridade sobre o cooldown de dismiss", () => {
    const oneDayAgo = String(NOW - 24 * 60 * 60 * 1000);
    expect(
      resolveSuggestionCheck({ browserSupports: true, triedFlag: "tried", dismissedAt: oneDayAgo, now: NOW }),
    ).toEqual({ shouldCheck: true, isForm1: true });
  });

  it("Forma 2: shouldCheck=true quando nunca foi dispensado", () => {
    expect(
      resolveSuggestionCheck({ browserSupports: true, triedFlag: null, dismissedAt: null, now: NOW }),
    ).toEqual({ shouldCheck: true, isForm1: false });
  });

  it("Forma 2: shouldCheck=true quando passaram mais de 7 dias desde o dismiss", () => {
    const eightDaysAgo = String(NOW - SEVEN_DAYS_MS - 1);
    expect(
      resolveSuggestionCheck({ browserSupports: true, triedFlag: null, dismissedAt: eightDaysAgo, now: NOW }),
    ).toEqual({ shouldCheck: true, isForm1: false });
  });

  it("não dispara dentro dos 7 dias de cooldown (Forma 2)", () => {
    const sixDaysAgo = String(NOW - SEVEN_DAYS_MS + 60_000);
    expect(
      resolveSuggestionCheck({ browserSupports: true, triedFlag: null, dismissedAt: sixDaysAgo, now: NOW }),
    ).toEqual({ shouldCheck: false });
  });

  it("não dispara se o browser não suporta WebAuthn", () => {
    expect(
      resolveSuggestionCheck({ browserSupports: false, triedFlag: "tried", dismissedAt: null, now: NOW }),
    ).toEqual({ shouldCheck: false });
  });
});

describe("resolveShowModal", () => {
  it("Forma 1 dispara o modal quando credentialCount é 0", () => {
    const check = resolveSuggestionCheck({ browserSupports: true, triedFlag: "tried", dismissedAt: null, now: NOW });
    expect(resolveShowModal(check, 0)).toBe(true);
  });

  it("Forma 2 dispara o modal quando credentialCount é 0 e nunca dispensado", () => {
    const check = resolveSuggestionCheck({ browserSupports: true, triedFlag: null, dismissedAt: null, now: NOW });
    expect(resolveShowModal(check, 0)).toBe(true);
  });

  it("não dispara se o usuário já tem credencial WebAuthn cadastrada", () => {
    const check = resolveSuggestionCheck({ browserSupports: true, triedFlag: "tried", dismissedAt: null, now: NOW });
    expect(resolveShowModal(check, 1)).toBe(false);
  });

  it("não dispara se o browser não suporta WebAuthn (shouldCheck=false)", () => {
    const check = resolveSuggestionCheck({ browserSupports: false, triedFlag: null, dismissedAt: null, now: NOW });
    expect(resolveShowModal(check, 0)).toBe(false);
  });
});
