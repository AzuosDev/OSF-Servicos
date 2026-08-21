import { describe, expect, it } from "vitest";

import { budgetPdfFileName, followsPanelTier, panelTierUnitPrice } from "./orcamentos";

describe("budgetPdfFileName", () => {
  const createdAt = "2026-08-18T12:00:00.000Z";

  it("joins the slugified client name and the creation date", () => {
    expect(budgetPdfFileName("Azuos Dev", createdAt)).toBe("azuos-dev_18-08-26");
  });

  it("strips accents and punctuation from the client name", () => {
    expect(budgetPdfFileName("Construções São João Ltda.", createdAt)).toBe("construcoes-sao-joao-ltda_18-08-26");
  });

  it("collapses separators instead of repeating hyphens", () => {
    expect(budgetPdfFileName("  Maria   /  José  ", createdAt)).toBe("maria-jose_18-08-26");
  });

  it('falls back to "cliente" when the name is unknown or unusable', () => {
    expect(budgetPdfFileName("", createdAt)).toBe("cliente_18-08-26");
    expect(budgetPdfFileName("***", createdAt)).toBe("cliente_18-08-26");
  });

  it("pads day and month and keeps the two-digit year", () => {
    expect(budgetPdfFileName("Cliente", "2026-01-05T15:00:00.000Z")).toBe("cliente_05-01-26");
  });

  it("reads the date in the company timezone, matching the backend filename and the PDF header", () => {
    // 02:00 UTC do dia 19 ainda é 23:00 do dia 18 em Fortaleza.
    expect(budgetPdfFileName("Cliente", "2026-08-19T02:00:00.000Z")).toBe("cliente_18-08-26");
  });
});

describe("panelTierUnitPrice", () => {
  it("spreads the tiered price across the quantity", () => {
    expect(panelTierUnitPrice(10)).toBe(20); // 10 x R$20
    expect(panelTierUnitPrice(20)).toBe(17.5); // (200 + 10 x R$15) / 20
  });
});

describe("followsPanelTier", () => {
  it("recognises an item still priced by the tier table", () => {
    expect(followsPanelTier("Limpeza de placas", 20, 17.5)).toBe(true);
  });

  it("rejects an item whose price was overridden by hand", () => {
    expect(followsPanelTier("Limpeza de placas", 20, 30)).toBe(false);
  });

  it("never applies to a service outside the panel-cleaning rule", () => {
    expect(followsPanelTier("Instalação de painel solar", 20, 17.5)).toBe(false);
  });
});
