import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { ModalShell } from "./ModalShell";
import { CurrencyInput } from "../ui/CurrencyInput";
import { QuantityInput } from "../ui/QuantityInput";
import { formatCurrency } from "../../lib/finance";
import { followsPanelTier, isPanelCleaningService, panelTierUnitPrice } from "../../lib/orcamentos";
import type { Budget, Service } from "../../types/api";

export type BudgetEditPayload = {
  items: { serviceId: string; quantity: number; unitPriceOverride: number }[];
  discount: number;
  notes?: string;
  validUntil?: string;
};

type EditableItem = {
  serviceId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  /**
   * Limpeza de placas é cobrada por faixa (as 10 primeiras a R$20, as seguintes a R$15), então
   * o preço unitário é derivado da quantidade. Enquanto o item seguir a faixa, mudar a
   * quantidade recalcula o unitário; assim que o usuário digita um preço, ele passa a mandar.
   */
  followsPanelTier: boolean;
};

// `validUntil` chega em ISO e o input date espera YYYY-MM-DD. A fatia é feita sobre a parte
// UTC do ISO para não deslocar um dia em fusos negativos, como o do Brasil.
const toDateInputValue = (iso?: string) => (iso ? iso.slice(0, 10) : "");

export function BudgetEditModal({
  open,
  budget,
  services,
  isPending,
  errorMessage,
  onClose,
  onSubmit,
}: {
  open: boolean;
  budget: Budget | null;
  services: Service[];
  isPending: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (payload: BudgetEditPayload, options: { thenDownload: boolean }) => void;
}) {
  const [items, setItems] = useState<EditableItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [serviceToAdd, setServiceToAdd] = useState("");

  // Recarrega o formulário sempre que o modal abre com outro orçamento, para não mostrar
  // os valores do orçamento anterior.
  useEffect(() => {
    if (!open || !budget) return;
    setItems(
      budget.items.map((item) => ({
        serviceId: item.serviceId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        followsPanelTier: followsPanelTier(item.name, item.quantity, item.unitPrice),
      })),
    );
    setDiscount(budget.discount ?? 0);
    setNotes(budget.notes ?? "");
    setValidUntil(toDateInputValue(budget.validUntil));
    setServiceToAdd("");
  }, [open, budget]);

  const itemsTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [items],
  );
  const travelCost = budget?.travelCost ?? 0;
  const total = Math.max(0, itemsTotal + travelCost - discount);

  const updateItem = (index: number, patch: Partial<EditableItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const changeQuantity = (index: number, quantity: number) => {
    const item = items[index];
    updateItem(index, {
      quantity,
      ...(item.followsPanelTier && { unitPrice: panelTierUnitPrice(quantity) }),
    });
  };

  const addService = (serviceId: string) => {
    const service = services.find((s) => s._id === serviceId);
    if (!service) return;
    setItems((prev) => [
      ...prev,
      {
        serviceId: service._id,
        name: service.name,
        quantity: 1,
        unitPrice: isPanelCleaningService(service.name) ? panelTierUnitPrice(1) : service.defaultValue,
        followsPanelTier: isPanelCleaningService(service.name),
      },
    ]);
    setServiceToAdd("");
  };

  const submit = (thenDownload: boolean) => {
    onSubmit(
      {
        items: items.map((item) => ({
          serviceId: item.serviceId,
          quantity: item.quantity,
          // Sempre enviado como override: o valor exibido aqui é o que o usuário conferiu,
          // então o backend não deve substituí-lo pelo preço atual do catálogo.
          unitPriceOverride: item.unitPrice,
        })),
        discount,
        notes: notes.trim(),
        validUntil: validUntil ? new Date(`${validUntil}T00:00:00.000Z`).toISOString() : undefined,
      },
      { thenDownload },
    );
  };

  if (!open || !budget) {
    return null;
  }

  const hasInvalidItem = items.some((item) => item.quantity < 1 || item.unitPrice <= 0);
  const canSubmit = items.length > 0 && !hasInvalidItem && !isPending;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={`Editar orçamento #${String(budget.sequenceNumber).padStart(4, "0")}`}
      icon={<Pencil className="h-6 w-6 text-accent-gold" />}
      footer={
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text-secondary">Total</span>
            <span className="font-sans text-xl font-extrabold text-accent-gold">{formatCurrency(total)}</span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-xl border border-bg-muted bg-transparent px-5 py-3 text-sm font-bold text-white transition hover:bg-bg-overlay disabled:cursor-not-allowed disabled:opacity-70 sm:flex-1"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => submit(false)}
              disabled={!canSubmit}
              className="rounded-xl border border-accent-gold bg-transparent px-5 py-3 text-sm font-bold text-accent-gold transition hover:bg-accent-gold/10 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={!canSubmit}
              className="flex items-center justify-center gap-2 rounded-xl bg-accent-gold px-5 py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar e baixar PDF
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-3">
          <span className="block text-sm font-semibold text-text-secondary">Serviços</span>

          {items.map((item, index) => (
            <div key={`${item.serviceId}-${index}`} className="rounded-xl border border-border-default bg-bg-muted/30 p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <span className="text-sm font-semibold text-text-primary">{item.name}</span>
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                  aria-label={`Remover ${item.name}`}
                  className="shrink-0 rounded-lg p-1 text-text-secondary transition hover:bg-bg-overlay hover:text-accent-red"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs text-text-secondary">Qtd</span>
                  <QuantityInput
                    value={item.quantity}
                    onChange={(quantity) => changeQuantity(index, quantity)}
                    label={`Quantidade de ${item.name}`}
                    className="w-full rounded-lg border border-bg-muted bg-bg-muted px-3 py-2 text-sm text-white outline-none focus:border-accent-gold"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-text-secondary">Valor unit.</span>
                  <CurrencyInput
                    value={item.unitPrice}
                    onChange={(value) => updateItem(index, { unitPrice: value, followsPanelTier: false })}
                    className="w-full rounded-lg border border-bg-muted bg-bg-muted px-3 py-2 text-sm text-white outline-none focus:border-accent-gold"
                  />
                </label>
              </div>
              <p className="mt-2 text-right text-xs text-text-secondary">
                Subtotal: {formatCurrency(item.unitPrice * item.quantity)}
              </p>
            </div>
          ))}

          {items.length === 0 && (
            <p className="rounded-xl bg-accent-red/10 p-3 text-xs text-accent-red">
              O orçamento precisa de pelo menos um serviço.
            </p>
          )}

          <label className="block">
            <span className="mb-1 block text-xs text-text-secondary">Adicionar serviço</span>
            <div className="flex gap-2">
              <select
                value={serviceToAdd}
                onChange={(e) => setServiceToAdd(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-bg-muted bg-bg-muted px-3 py-2 text-sm text-white outline-none focus:border-accent-gold"
              >
                <option value="">Selecione um serviço</option>
                {services.map((service) => (
                  <option key={service._id} value={service._id}>
                    {service.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => addService(serviceToAdd)}
                disabled={!serviceToAdd}
                aria-label="Adicionar serviço ao orçamento"
                className="shrink-0 rounded-lg border border-border-default px-3 py-2 text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </label>
        </div>

        {travelCost > 0 && (
          <div className="flex justify-between rounded-xl bg-bg-muted/30 px-3 py-2 text-sm">
            <span className="text-text-secondary">Deslocamento (não editável aqui)</span>
            <span className="font-semibold">{formatCurrency(travelCost)}</span>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm text-text-secondary">Desconto</span>
            <CurrencyInput
              value={discount}
              onChange={setDiscount}
              className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-text-secondary">Válido até</span>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm text-text-secondary">Observações</span>
          <textarea
            rows={3}
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full resize-none rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold"
          />
        </label>

        {errorMessage && (
          <div className="rounded-xl bg-accent-red/10 p-3 text-sm text-accent-red">{errorMessage}</div>
        )}
      </div>
    </ModalShell>
  );
}
