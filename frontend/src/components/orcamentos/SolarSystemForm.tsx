import { Plus, Trash2 } from "lucide-react";

import { CurrencyInput } from "../ui/CurrencyInput";
import { formatCurrency } from "../../lib/finance";
import {
  emptyInverterRow,
  emptyPanelRow,
  formSystemPowerKwp,
  projectedMonthlySavings,
  solarFormIssues,
  type SolarFormState,
} from "../../lib/solar";
import type { SolarInverterType } from "../../types/api";

/**
 * Formulário do sistema fotovoltaico — os únicos dados que o orçamento solar precisa do
 * usuário. Geração, T.I.R., payback e economia são todos derivados destes campos pelo
 * backend; nada disso é digitado.
 */

const INPUT_CLASS =
  "w-full rounded-xl border border-bg-muted bg-bg-muted px-3 py-2.5 text-sm text-white outline-none focus:border-accent-gold";

const LABEL_CLASS = "mb-1 block text-xs text-text-secondary";

export type SolarSystemFormProps = {
  value: SolarFormState;
  onChange: (next: SolarFormState) => void;
};

export function SolarSystemForm({ value, onChange }: SolarSystemFormProps) {
  const issues = solarFormIssues(value);
  const powerKwp = formSystemPowerKwp(value);
  const savings = projectedMonthlySavings(value);

  const patch = (partial: Partial<SolarFormState>) => onChange({ ...value, ...partial });

  const updatePanel = (index: number, field: keyof SolarFormState["panels"][number], fieldValue: string) =>
    patch({ panels: value.panels.map((row, i) => (i === index ? { ...row, [field]: fieldValue } : row)) });

  const updateInverter = (index: number, field: "quantity" | "model" | "wattage", fieldValue: string) =>
    patch({ inverters: value.inverters.map((row, i) => (i === index ? { ...row, [field]: fieldValue } : row)) });

  const updateInverterType = (index: number, type: SolarInverterType) =>
    patch({ inverters: value.inverters.map((row, i) => (i === index ? { ...row, type } : row)) });

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-text-primary">Painéis solares</h3>
          <button
            type="button"
            onClick={() => patch({ panels: [...value.panels, emptyPanelRow()] })}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-accent-gold transition hover:bg-bg-overlay"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar modelo
          </button>
        </div>

        {value.panels.map((panel, index) => (
          <div key={index} className="grid grid-cols-[1fr_1fr_1.4fr_auto] items-end gap-2">
            <label className="block">
              <span className={LABEL_CLASS}>Qtd</span>
              <input
                type="number"
                min={1}
                step="1"
                inputMode="numeric"
                placeholder="12"
                value={panel.quantity}
                onChange={(e) => updatePanel(index, "quantity", e.target.value)}
                className={INPUT_CLASS}
              />
            </label>
            <label className="block">
              <span className={LABEL_CLASS}>Potência (Wp)</span>
              <input
                type="number"
                min={1}
                step="1"
                inputMode="numeric"
                placeholder="550"
                value={panel.wattagePeak}
                onChange={(e) => updatePanel(index, "wattagePeak", e.target.value)}
                className={INPUT_CLASS}
              />
            </label>
            <label className="block">
              <span className={LABEL_CLASS}>Modelo (opcional)</span>
              <input
                type="text"
                maxLength={150}
                placeholder="Canadian 550W"
                value={panel.model}
                onChange={(e) => updatePanel(index, "model", e.target.value)}
                className={INPUT_CLASS}
              />
            </label>
            <button
              type="button"
              disabled={value.panels.length === 1}
              onClick={() => patch({ panels: value.panels.filter((_, i) => i !== index) })}
              aria-label="Remover painel"
              className="mb-1 rounded-lg p-2 text-text-muted transition hover:bg-bg-overlay hover:text-accent-red disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-text-primary">Inversor / microinversor</h3>
          <button
            type="button"
            onClick={() => patch({ inverters: [...value.inverters, emptyInverterRow()] })}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-accent-gold transition hover:bg-bg-overlay"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar modelo
          </button>
        </div>

        {value.inverters.map((inverter, index) => (
          <div key={index} className="space-y-2 rounded-xl border border-border-default p-3">
            <div className="flex gap-2">
              {(["INVERSOR", "MICROINVERSOR"] as SolarInverterType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => updateInverterType(index, type)}
                  className={
                    inverter.type === type
                      ? "flex-1 rounded-lg bg-accent-gold px-3 py-2 text-xs font-bold text-black"
                      : "flex-1 rounded-lg border border-border-default px-3 py-2 text-xs font-semibold text-text-secondary transition hover:bg-bg-overlay"
                  }
                >
                  {type === "INVERSOR" ? "Inversor" : "Microinversor"}
                </button>
              ))}
              <button
                type="button"
                disabled={value.inverters.length === 1}
                onClick={() => patch({ inverters: value.inverters.filter((_, i) => i !== index) })}
                aria-label="Remover inversor"
                className="rounded-lg p-2 text-text-muted transition hover:bg-bg-overlay hover:text-accent-red disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-2">
              <label className="block">
                <span className={LABEL_CLASS}>Qtd</span>
                <input
                  type="number"
                  min={1}
                  step="1"
                  inputMode="numeric"
                  placeholder="1"
                  value={inverter.quantity}
                  onChange={(e) => updateInverter(index, "quantity", e.target.value)}
                  className={INPUT_CLASS}
                />
              </label>
              <label className="block">
                <span className={LABEL_CLASS}>Potência (W)</span>
                <input
                  type="number"
                  min={1}
                  step="1"
                  inputMode="numeric"
                  placeholder="6000"
                  value={inverter.wattage}
                  onChange={(e) => updateInverter(index, "wattage", e.target.value)}
                  className={INPUT_CLASS}
                />
              </label>
              <label className="block">
                <span className={LABEL_CLASS}>Modelo (opcional)</span>
                <input
                  type="text"
                  maxLength={150}
                  placeholder="Growatt 6kW"
                  value={inverter.model}
                  onChange={(e) => updateInverter(index, "model", e.target.value)}
                  className={INPUT_CLASS}
                />
              </label>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-bold text-text-primary">Valores</h3>

        <label className="block">
          <span className={LABEL_CLASS}>Valor do pedido</span>
          <CurrencyInput
            value={value.investment}
            onChange={(investment) => patch({ investment })}
            className={INPUT_CLASS}
          />
        </label>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className={LABEL_CLASS}>Fatura de energia hoje</span>
            <CurrencyInput
              value={value.currentMonthlyBill}
              onChange={(currentMonthlyBill) => patch({ currentMonthlyBill })}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>Fatura com o sistema instalado</span>
            <CurrencyInput
              value={value.projectedMonthlyBill}
              onChange={(projectedMonthlyBill) => patch({ projectedMonthlyBill })}
              className={INPUT_CLASS}
            />
          </label>
        </div>
        <p className="text-xs text-text-muted">
          As duas faturas são informadas por você — não vêm no pedido da distribuidora. É a diferença entre
          elas que gera a economia, o payback e a T.I.R. da proposta.
        </p>
      </section>

      {/* Conferência antes de enviar: dois números derivados do que foi digitado. */}
      {(powerKwp > 0 || savings > 0) && (
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-bg-muted/50 p-4">
          <div>
            <p className="text-xs text-text-secondary">Potência do sistema</p>
            <p className="font-sans text-lg font-bold text-text-primary">
              {powerKwp.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWp
            </p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Economia mensal</p>
            <p className="font-sans text-lg font-bold text-accent-gold">{formatCurrency(savings)}</p>
          </div>
        </div>
      )}

      {issues.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-accent-orange/10 p-3 text-xs text-accent-orange">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
