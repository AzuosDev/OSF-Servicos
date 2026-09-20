import { describe, expect, it } from "vitest";
import {
  emptySolarForm,
  solarFormFromParsedOrder,
  formSystemPowerKwp,
  isSolarFormValid,
  projectedMonthlySavings,
  solarFormIssues,
  toSolarPayload,
  type SolarFormState,
} from "./solar";

const filled = (overrides: Partial<SolarFormState> = {}): SolarFormState => ({
  panels: [{ quantity: "12", wattagePeak: "550", model: "Canadian 550W" }],
  inverters: [{ quantity: "1", type: "INVERSOR", model: "Growatt", wattage: "6000" }],
  investment: 30000,
  currentMonthlyBill: 850,
  projectedMonthlyBill: 120,
  ...overrides,
});

describe("solarFormIssues", () => {
  it("reports nothing for a complete form", () => {
    expect(solarFormIssues(filled())).toEqual([]);
    expect(isSolarFormValid(filled())).toBe(true);
  });

  it("starts empty and therefore invalid", () => {
    expect(isSolarFormValid(emptySolarForm())).toBe(false);
  });

  it("requires a panel with both quantity and wattage", () => {
    const issues = solarFormIssues(filled({ panels: [{ quantity: "12", wattagePeak: "", model: "" }] }));
    expect(issues).toContain("Informe ao menos um painel com quantidade e potência.");
  });

  it("requires an inverter", () => {
    const issues = solarFormIssues(filled({ inverters: [{ quantity: "", type: "INVERSOR", model: "", wattage: "" }] }));
    expect(issues).toContain("Informe ao menos um inversor ou microinversor com quantidade.");
  });

  it("requires the order value and the current bill", () => {
    expect(solarFormIssues(filled({ investment: 0 }))).toContain("Informe o valor do pedido.");
    expect(solarFormIssues(filled({ currentMonthlyBill: 0 }))).toContain(
      "Informe a fatura de energia atual do cliente.",
    );
  });

  // Fatura maior depois da instalação significaria economia negativa impressa na proposta.
  it("refuses a projected bill higher than the current one", () => {
    const issues = solarFormIssues(filled({ currentMonthlyBill: 300, projectedMonthlyBill: 400 }));
    expect(issues).toContain("A fatura com o sistema não pode ser maior que a fatura atual.");
  });

  it("accepts a projected bill of zero", () => {
    expect(isSolarFormValid(filled({ projectedMonthlyBill: 0 }))).toBe(true);
  });

  it("rejects a quantity that is not a whole positive number", () => {
    for (const quantity of ["0", "-1", "1.5", "abc"]) {
      const issues = solarFormIssues(filled({ panels: [{ quantity, wattagePeak: "550", model: "" }] }));
      expect(issues).toContain("Informe ao menos um painel com quantidade e potência.");
    }
  });

  it("accepts the form when at least one of several panel rows is complete", () => {
    const form = filled({
      panels: [
        { quantity: "12", wattagePeak: "550", model: "" },
        { quantity: "", wattagePeak: "", model: "" },
      ],
    });
    expect(isSolarFormValid(form)).toBe(true);
  });
});

describe("formSystemPowerKwp", () => {
  it("converts watt-peak to kWp", () => {
    expect(formSystemPowerKwp(filled())).toBe(6.6);
  });

  it("sums panel models of different wattage", () => {
    const form = filled({
      panels: [
        { quantity: "8", wattagePeak: "550", model: "" },
        { quantity: "4", wattagePeak: "450", model: "" },
      ],
    });
    expect(formSystemPowerKwp(form)).toBe(6.2);
  });

  it("ignores incomplete rows instead of counting them as zero-watt panels", () => {
    const form = filled({
      panels: [
        { quantity: "12", wattagePeak: "550", model: "" },
        { quantity: "5", wattagePeak: "", model: "" },
      ],
    });
    expect(formSystemPowerKwp(form)).toBe(6.6);
  });

  it("is zero for an empty form", () => {
    expect(formSystemPowerKwp(emptySolarForm())).toBe(0);
  });
});

describe("projectedMonthlySavings", () => {
  it("is the difference between the two bills", () => {
    expect(projectedMonthlySavings(filled())).toBe(730);
  });

  it("never goes negative", () => {
    expect(projectedMonthlySavings(filled({ currentMonthlyBill: 100, projectedMonthlyBill: 400 }))).toBe(0);
  });
});

describe("toSolarPayload", () => {
  it("builds the API body with numbers, not strings", () => {
    const payload = toSolarPayload(filled());

    expect(payload.panels).toEqual([{ quantity: 12, wattagePeak: 550, model: "Canadian 550W" }]);
    expect(payload.inverters).toEqual([{ quantity: 1, type: "INVERSOR", model: "Growatt", wattage: 6000 }]);
    expect(payload.investment).toBe(30000);
  });

  it("omits an empty model instead of sending an empty string", () => {
    const payload = toSolarPayload(
      filled({
        panels: [{ quantity: "12", wattagePeak: "550", model: "   " }],
        inverters: [{ quantity: "1", type: "MICROINVERSOR", model: "", wattage: "" }],
      }),
    );

    expect(payload.panels[0]).not.toHaveProperty("model");
    expect(payload.inverters[0]).not.toHaveProperty("model");
    expect(payload.inverters[0]).not.toHaveProperty("wattage");
    expect(payload.inverters[0].type).toBe("MICROINVERSOR");
  });

  // Uma linha em branco deixada no formulário não pode virar um painel de 0 W no pedido.
  it("drops incomplete rows", () => {
    const payload = toSolarPayload(
      filled({
        panels: [
          { quantity: "12", wattagePeak: "550", model: "" },
          { quantity: "", wattagePeak: "", model: "" },
        ],
        inverters: [
          { quantity: "1", type: "INVERSOR", model: "", wattage: "" },
          { quantity: "", type: "INVERSOR", model: "", wattage: "" },
        ],
      }),
    );

    expect(payload.panels).toHaveLength(1);
    expect(payload.inverters).toHaveLength(1);
  });
});

describe("solarFormFromParsedOrder", () => {
  const parsed = {
    panels: [{ quantity: 4, wattagePeak: 700, model: "Risen", sourceLine: "MODULO ... 700W" }],
    inverters: [
      { quantity: 1, type: "MICROINVERSOR" as const, wattage: 2250, model: "Growatt", sourceLine: "MICRO..." },
    ],
    investment: 4178.48,
    warnings: [],
  };

  it("fills the form from the parsed order", () => {
    const form = solarFormFromParsedOrder(parsed, emptySolarForm());

    expect(form.panels).toEqual([{ quantity: "4", wattagePeak: "700", model: "Risen" }]);
    expect(form.inverters[0]).toEqual({
      quantity: "1",
      type: "MICROINVERSOR",
      model: "Growatt",
      wattage: "2250",
    });
    expect(form.investment).toBe(4178.48);
  });

  // As faturas não vêm no pedido; reenviar o PDF não pode apagar o que foi digitado.
  it("keeps the bills the user already typed", () => {
    const current = { ...emptySolarForm(), currentMonthlyBill: 850, projectedMonthlyBill: 120 };
    const form = solarFormFromParsedOrder(parsed, current);

    expect(form.currentMonthlyBill).toBe(850);
    expect(form.projectedMonthlyBill).toBe(120);
  });

  it("leaves an unread quantity blank instead of zero", () => {
    const form = solarFormFromParsedOrder(
      { ...parsed, panels: [{ wattagePeak: 550, sourceLine: "MODULO 550W" }] },
      emptySolarForm(),
    );

    expect(form.panels[0].quantity).toBe("");
    expect(form.panels[0].wattagePeak).toBe("550");
  });

  it("keeps the current rows when the parser found no equipment", () => {
    const current = { ...emptySolarForm(), investment: 999 };
    const form = solarFormFromParsedOrder({ panels: [], inverters: [], warnings: [] }, current);

    expect(form.panels).toEqual(current.panels);
    expect(form.inverters).toEqual(current.inverters);
    expect(form.investment).toBe(999);
  });
});
