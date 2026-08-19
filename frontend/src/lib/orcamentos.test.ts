import { describe, expect, it } from "vitest";

import { budgetPdfFileName } from "./orcamentos";

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
    expect(budgetPdfFileName("Cliente", "2026-01-05T00:00:00.000Z")).toBe("cliente_05-01-26");
  });

  it("reads the date in UTC, matching the backend filename and the PDF header", () => {
    expect(budgetPdfFileName("Cliente", "2026-08-19T02:00:00.000Z")).toBe("cliente_19-08-26");
  });
});
