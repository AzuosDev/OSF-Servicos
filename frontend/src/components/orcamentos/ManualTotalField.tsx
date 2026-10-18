import { Calculator, Pencil } from "lucide-react";

import { CurrencyInput } from "../ui/CurrencyInput";
import { formatCurrency } from "../../lib/finance";
import { isManualTotalValid } from "../../lib/orcamentos";
import { cn } from "../../lib/utils";

/**
 * Escolha entre o total calculado e um valor fechado à mão.
 *
 * O modo manual fica em laranja de propósito — a mesma cor do selo "Valor manual" no total e
 * na listagem — para que o orçamento fora do cálculo seja reconhecido de relance.
 */
export function ManualTotalField({
  calculatedTotal,
  isManual,
  manualTotal,
  onModeChange,
  onManualTotalChange,
}: {
  calculatedTotal: number;
  isManual: boolean;
  manualTotal: number;
  onModeChange: (isManual: boolean) => void;
  onManualTotalChange: (value: number) => void;
}) {
  const isValid = isManualTotalValid(manualTotal, calculatedTotal);
  const difference = manualTotal - calculatedTotal;

  const optionClass = (active: boolean, activeClass: string) =>
    cn(
      "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition",
      active ? activeClass : "text-text-secondary hover:text-text-primary",
    );

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border p-4 transition",
        isManual ? "border-accent-orange/60 bg-accent-orange/5" : "border-border-default bg-bg-muted/30",
      )}
    >
      <div>
        <span className="block text-sm font-semibold text-text-secondary">Valor do orçamento</span>
        <div role="radiogroup" aria-label="Como definir o valor do orçamento" className="mt-2 flex gap-1 rounded-xl bg-bg-muted p-1">
          <button
            type="button"
            role="radio"
            aria-checked={!isManual}
            onClick={() => onModeChange(false)}
            className={optionClass(!isManual, "bg-bg-overlay text-text-primary")}
          >
            <Calculator className="h-4 w-4" />
            Automático
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={isManual}
            onClick={() => onModeChange(true)}
            className={optionClass(isManual, "bg-accent-orange text-black")}
          >
            <Pencil className="h-4 w-4" />
            Manual
          </button>
        </div>
      </div>

      {isManual ? (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Valor calculado</span>
            <span className="font-semibold text-text-secondary">{formatCurrency(calculatedTotal)}</span>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm text-text-secondary">Valor final do orçamento</span>
            <CurrencyInput
              value={manualTotal}
              onChange={onManualTotalChange}
              className={cn(
                "w-full rounded-xl border bg-bg-muted px-4 py-3 text-lg font-bold text-white outline-none",
                isValid ? "border-accent-orange/60 focus:border-accent-orange" : "border-accent-red focus:border-accent-red",
              )}
            />
          </label>
          {isValid ? (
            <p className="text-xs text-accent-orange">
              +{formatCurrency(difference)} sobre o calculado. O PDF lista os itens sem preços parciais e fecha neste valor.
            </p>
          ) : (
            <p className="text-xs text-accent-red">
              O valor manual precisa ser maior que {formatCurrency(calculatedTotal)}.
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-text-muted">Itens + deslocamento − desconto, calculados pelo sistema.</p>
      )}
    </div>
  );
}

/** Selo que marca um total definido à mão — usado no total do wizard, do modal e na listagem. */
export function ManualTotalBadge({ className }: { className?: string }) {
  return (
    <span
      title="Valor definido manualmente"
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-accent-orange/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-accent-orange",
        className,
      )}
    >
      <Pencil className="h-3 w-3" />
      Manual
    </span>
  );
}
