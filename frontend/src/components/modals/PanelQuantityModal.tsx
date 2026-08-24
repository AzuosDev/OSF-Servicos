import { useEffect, useState } from "react";
import { LayoutGrid } from "lucide-react";

import { formatCurrency } from "../../lib/finance";
import { calculatePanelCleaningSubtotal } from "../../lib/orcamentos";
import { MAX_QUANTITY } from "../ui/QuantityInput";
import { ModalShell } from "./ModalShell";

export function PanelQuantityModal({
  open,
  serviceName,
  initialQuantity,
  onClose,
  onConfirm,
}: {
  open: boolean;
  serviceName: string;
  initialQuantity: number;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
}) {
  const [value, setValue] = useState(String(initialQuantity));

  useEffect(() => {
    if (open) setValue(String(initialQuantity));
  }, [open, initialQuantity]);

  if (!open) {
    return null;
  }

  const quantity = Math.floor(Number(value));
  const isValid = Number.isFinite(quantity) && quantity >= 1 && quantity <= MAX_QUANTITY;
  const subtotal = isValid ? calculatePanelCleaningSubtotal(quantity) : 0;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={serviceName}
      icon={<LayoutGrid className="h-6 w-6 text-accent-gold" />}
      footer={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-bg-muted bg-transparent px-5 py-3 text-sm font-bold text-white transition hover:bg-bg-overlay"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="panel-quantity-form"
            disabled={!isValid}
            className="flex-1 rounded-xl bg-accent-gold px-5 py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Adicionar ao orçamento
          </button>
        </div>
      }
    >
      <form
        id="panel-quantity-form"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (isValid) onConfirm(quantity);
        }}
      >
        <p className="text-sm text-text-secondary">
          Este serviço é cobrado por quantidade de placas, não por um valor fixo.
        </p>

        <label className="block">
          <span className="mb-1 block text-sm text-text-secondary">Quantidade de placas</span>
          <input
            type="number"
            min={1}
            max={MAX_QUANTITY}
            step={1}
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold"
          />
          {!isValid && value.trim() !== "" && (
            <p className="mt-1 text-xs text-accent-red">
              Informe uma quantidade entre 1 e {MAX_QUANTITY.toLocaleString("pt-BR")} placas.
            </p>
          )}
        </label>

        <div className="space-y-2 rounded-xl bg-bg-muted px-4 py-3 text-xs text-text-secondary">
          <p className="font-semibold uppercase tracking-wide text-text-muted">Como é calculado</p>
          <p>Até 10 placas: {formatCurrency(20)} por placa.</p>
          <p>
            Acima de 10 placas: {formatCurrency(200)} pelas 10 primeiras + {formatCurrency(15)} por placa adicional.
          </p>
        </div>

        {isValid && (
          <div className="flex items-center justify-between rounded-xl bg-bg-muted px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-text-secondary">
                {quantity} {quantity === 1 ? "placa" : "placas"}
              </p>
              {quantity > 10 && (
                <p className="text-xs text-text-muted">
                  {formatCurrency(200)} + {quantity - 10} × {formatCurrency(15)}
                </p>
              )}
            </div>
            <span className="font-sans text-2xl font-extrabold text-accent-gold">{formatCurrency(subtotal)}</span>
          </div>
        )}
      </form>
    </ModalShell>
  );
}
