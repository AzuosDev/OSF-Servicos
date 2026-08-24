import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  MapPin,
  Minus,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { api } from "../lib/api";
import { formatCurrency } from "../lib/finance";
import { getApiErrorMessages } from "../lib/errors";
import { cn } from "../lib/utils";
import { ClientFormModal } from "../components/modals/ClientFormModal";
import { PanelQuantityModal } from "../components/modals/PanelQuantityModal";
import { clampQuantity, MAX_QUANTITY, QuantityInput } from "../components/ui/QuantityInput";
import {
  calculateBudgetItemSubtotal,
  calculatePanelCleaningSubtotal,
  isPanelCleaningService,
} from "../lib/orcamentos";
import type {
  Budget,
  Client,
  CompanySettings,
  DistanceCalculationResult,
  Service,
} from "../types/api";

type WizardStep = 1 | 2 | 3 | 4 | 5;

type CartItem = {
  service: Service;
  quantity: number;
  unitPriceOverride?: number;
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

function defaultValidUntil(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

const STEP_LABELS: Record<WizardStep, string> = {
  1: "Cliente",
  2: "Serviços",
  3: "Deslocamento",
  4: "Revisão",
  5: "Confirmação",
};

export function OrcamentoWizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>(1);

  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientModalOpen, setClientModalOpen] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [panelModalService, setPanelModalService] = useState<Service | null>(null);

  const [destinationAddress, setDestinationAddress] = useState("");
  const [skipDistance, setSkipDistance] = useState(false);
  const [distancePreview, setDistancePreview] = useState<DistanceCalculationResult | null>(null);

  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState(defaultValidUntil());

  const [createdBudget, setCreatedBudget] = useState<Budget | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const companySettingsQuery = useQuery<CompanySettings | null>({
    queryKey: ["orcamentos-company-settings"],
    queryFn: () => api.get<CompanySettings | null>("/api/orcamentos/company-settings").then((r) => r.data),
  });

  const clientsQuery = useQuery<Client[]>({
    queryKey: ["orcamentos-clients", "active"],
    queryFn: () => api.get<Client[]>("/api/orcamentos/clients?activeOnly=true").then((r) => r.data),
    enabled: step === 1,
  });

  const servicesQuery = useQuery<Service[]>({
    queryKey: ["services", "active"],
    queryFn: () => api.get<Service[]>("/api/services?activeOnly=true").then((r) => r.data),
    enabled: step === 2,
  });

  const filteredClients = useMemo(() => {
    const list = clientsQuery.data ?? [];
    const term = clientSearch.trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (c) => c.name.toLowerCase().includes(term) || (c.phone ?? "").toLowerCase().includes(term),
    );
  }, [clientsQuery.data, clientSearch]);

  const itemsTotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum +
          calculateBudgetItemSubtotal(item.service.name, item.service.defaultValue, item.quantity, item.unitPriceOverride),
        0,
      ),
    [cart],
  );
  const travelCost = distancePreview?.travelCost ?? 0;
  const total = Math.max(0, itemsTotal + travelCost - discount);

  // Memória de cálculo da limpeza de placas — entra nas observações do orçamento
  // automaticamente, já que o valor não vem de um preço fixo do serviço.
  const panelCleaningNote = useMemo(
    () =>
      cart
        .filter((item) => isPanelCleaningService(item.service.name))
        .map((item) => {
          const { quantity } = item;
          const breakdown =
            quantity <= 10
              ? `${quantity} × ${formatCurrency(20)}`
              : `${formatCurrency(200)} (10 primeiras) + ${quantity - 10} × ${formatCurrency(15)}`;
          const unit = quantity === 1 ? "placa" : "placas";
          return `${item.service.name}: ${quantity} ${unit} — ${breakdown} = ${formatCurrency(
            calculatePanelCleaningSubtotal(quantity),
          )}`;
        })
        .join("\n"),
    [cart],
  );

  const previousPanelNoteRef = useRef("");
  useEffect(() => {
    const previous = previousPanelNoteRef.current;
    if (previous === panelCleaningNote) return;
    setNotes((current) => {
      if (previous && current.includes(previous)) {
        return current.replace(previous, panelCleaningNote).trim();
      }
      if (!panelCleaningNote) return current;
      return current.trim() ? `${current.trim()}\n${panelCleaningNote}` : panelCleaningNote;
    });
    previousPanelNoteRef.current = panelCleaningNote;
  }, [panelCleaningNote]);

  const calculateDistanceMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<DistanceCalculationResult>("/api/orcamentos/distance/calculate", {
        destinationAddress: destinationAddress.trim(),
      });
      return data;
    },
    onSuccess: (data) => {
      setDistancePreview(data);
      setStep(4);
    },
  });

  const createBudgetMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClient) throw new Error("Cliente não selecionado");
      const { data } = await api.post<Budget>("/api/orcamentos/budgets", {
        clientId: selectedClient._id,
        items: cart.map((item) => ({
          serviceId: item.service._id,
          quantity: item.quantity,
          ...(item.unitPriceOverride != null && { unitPriceOverride: item.unitPriceOverride }),
        })),
        calculateDistance: !skipDistance,
        destinationAddress: !skipDistance ? destinationAddress.trim() || selectedClient.address : undefined,
        discount: discount || undefined,
        notes: notes.trim() || undefined,
        validUntil: `${validUntil}T00:00:00.000Z`,
      });
      return data;
    },
    onSuccess: (budget) => {
      setCreatedBudget(budget);
      setCreateError(null);
      setStep(5);
    },
    onError: (error) => {
      setCreateError(getApiErrorMessages(error, "Não foi possível criar o orçamento.")[0]);
    },
  });

  const downloadPdfMutation = useMutation({
    mutationFn: async (budget: Budget) => {
      const response = await api.get(`/api/orcamentos/budgets/${budget._id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data as Blob);
      window.open(url, "_blank");
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    },
  });

  const selectClient = (client: Client) => {
    setSelectedClient(client);
    setDestinationAddress(client.address);
    setStep(2);
  };

  const addToCart = (service: Service) => {
    // Limpeza de placas não tem valor fixo — a quantidade de placas é sempre informada no modal.
    if (isPanelCleaningService(service.name)) {
      setPanelModalService(service);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.service._id === service._id);
      if (existing) {
        return prev.map((item) =>
          item.service._id === service._id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...prev, { service, quantity: 1 }];
    });
  };

  const setPanelQuantity = (service: Service, quantity: number) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.service._id === service._id);
      if (existing) {
        return prev.map((item) => (item.service._id === service._id ? { ...item, quantity } : item));
      }
      return [...prev, { service, quantity }];
    });
    setPanelModalService(null);
  };

  const updateQuantity = (serviceId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.service._id === serviceId
            // O mínimo é 0 para que o "-" em 1 continue removendo o item no filter abaixo;
            // o teto vale igual para o botão e para o campo digitado.
            ? { ...item, quantity: clampQuantity(item.quantity + delta, 0, MAX_QUANTITY) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const setQuantity = (serviceId: string, quantity: number) => {
    setCart((prev) =>
      prev.map((item) => (item.service._id === serviceId ? { ...item, quantity: clampQuantity(quantity) } : item)),
    );
  };

  const removeFromCart = (serviceId: string) => {
    setCart((prev) => prev.filter((item) => item.service._id !== serviceId));
  };

  const goBack = () => setStep((s) => (s > 1 ? ((s - 1) as WizardStep) : s));

  const companySettingsMissing = companySettingsQuery.data === null;

  if (companySettingsMissing && step < 5) {
    return (
      <section className="mx-auto max-w-lg">
        <div className="rounded-2xl border border-dashed border-border-default bg-bg-card p-8 text-center">
          <MapPin className="mx-auto h-10 w-10 text-accent-gold" />
          <h2 className="mt-4 text-xl font-semibold text-white">Configure os dados da empresa primeiro</h2>
          <p className="mt-2 text-sm text-text-secondary">
            O endereço de partida e o preço por km precisam estar cadastrados antes de criar um orçamento.
          </p>
          <Link
            to="/configuracoes"
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-accent-gold px-4 py-3 text-sm font-bold text-black transition hover:brightness-110"
          >
            Ir para Configurações
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-7">
      <header>
        <p className="mb-1 text-sm text-text-secondary">Orçamentos</p>
        <h1 className="font-sans text-3xl font-bold">Novo Orçamento</h1>
      </header>

      <div className="flex items-center gap-0 overflow-x-auto">
        {([1, 2, 3, 4, 5] as WizardStep[]).map((s, idx) => (
          <div key={s} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                  s === step
                    ? "bg-accent-gold text-black"
                    : s < step
                      ? "bg-accent-gold/20 text-accent-gold"
                      : "border border-border-default bg-bg-muted text-text-muted",
                )}
              >
                {s < step ? <CheckCircle2 className="h-4 w-4" /> : s}
              </div>
              <span
                className={cn(
                  "whitespace-nowrap text-sm font-semibold",
                  s === step ? "text-text-primary" : "text-text-muted",
                )}
              >
                {STEP_LABELS[s]}
              </span>
            </div>
            {idx < 4 && <div className="mx-2 h-px w-10 bg-border-default" />}
          </div>
        ))}
      </div>

      <div className="max-w-2xl flex-1 rounded-2xl border border-border-default bg-bg-card p-8">
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold">Selecione o cliente</h2>
              <p className="mt-1 text-sm text-text-secondary">Busque um cliente já cadastrado ou crie um novo.</p>
            </div>

            <div className="flex gap-3">
              <div className="flex flex-1 items-center gap-2 rounded-xl bg-bg-muted px-4 py-3">
                <Search className="h-4 w-4 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Buscar cliente por nome ou telefone..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-text-muted"
                />
              </div>
              <button
                type="button"
                onClick={() => setClientModalOpen(true)}
                className="flex items-center gap-2 whitespace-nowrap rounded-xl border border-border-strong bg-bg-muted px-4 py-3 text-sm font-semibold text-white transition hover:bg-bg-overlay"
              >
                <Plus className="h-4 w-4" />
                Novo cliente
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {clientsQuery.isLoading ? (
                <p className="text-sm text-text-secondary">Carregando clientes...</p>
              ) : filteredClients.length === 0 ? (
                <p className="text-sm text-text-secondary">Nenhum cliente encontrado.</p>
              ) : (
                filteredClients.map((client) => {
                  const active = selectedClient?._id === client._id;
                  return (
                    <button
                      key={client._id}
                      type="button"
                      onClick={() => selectClient(client)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition",
                        active
                          ? "border-accent-gold bg-accent-gold/10"
                          : "border-border-default hover:bg-bg-overlay",
                      )}
                    >
                      <div
                        className={cn(
                          "grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold",
                          active ? "bg-accent-gold text-black" : "bg-bg-muted text-text-secondary",
                        )}
                      >
                        {initials(client.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{client.name}</p>
                        <p className="truncate text-xs text-text-secondary">
                          {[client.phone, client.address].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      {active && <CheckCircle2 className="h-5 w-5 shrink-0 text-accent-gold" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold">Serviços</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Selecione os serviços incluídos neste orçamento. A quantidade pode ser digitada direto no campo.
              </p>
            </div>

            {servicesQuery.isLoading ? (
              <p className="text-sm text-text-secondary">Carregando serviços...</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {(servicesQuery.data ?? []).map((service) => (
                  <button
                    key={service._id}
                    type="button"
                    onClick={() => addToCart(service)}
                    className="flex items-center justify-between gap-2 rounded-xl bg-bg-muted px-4 py-3 text-left transition hover:bg-bg-overlay"
                  >
                    <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-white">
                      {service.name}
                    </span>
                    <span className="shrink-0 text-sm font-bold text-accent-gold">
                      {isPanelCleaningService(service.name) ? "Por placa" : formatCurrency(service.defaultValue)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {cart.length > 0 && (
              <div className="space-y-2 border-t border-border-default pt-4">
                {cart.map((item) => (
                  <div
                    key={item.service._id}
                    className="flex flex-col gap-3 rounded-xl border border-border-default p-3 sm:flex-row sm:items-center sm:px-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug">{item.service.name}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">
                        {isPanelCleaningService(item.service.name)
                          ? `${formatCurrency(20)}/placa até 10 · ${formatCurrency(15)}/placa acima`
                          : `${formatCurrency(item.unitPriceOverride ?? item.service.defaultValue)} / un.`}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      {isPanelCleaningService(item.service.name) ? (
                        <button
                          type="button"
                          onClick={() => setPanelModalService(item.service)}
                          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-bg-muted px-3 py-2 text-xs font-semibold text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
                        >
                          <Pencil className="h-3 w-3" />
                          {item.quantity} {item.quantity === 1 ? "placa" : "placas"}
                        </button>
                      ) : (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.service._id, -1)}
                            className="grid h-8 w-8 place-items-center rounded-lg bg-bg-muted text-text-secondary hover:bg-bg-overlay"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <QuantityInput
                            value={item.quantity}
                            onChange={(quantity) => setQuantity(item.service._id, quantity)}
                            label={`Quantidade de ${item.service.name}`}
                            className="w-20 rounded-lg border border-bg-muted bg-bg-muted px-1 py-1.5 text-sm font-bold text-white outline-none focus:border-accent-gold"
                          />
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.service._id, 1)}
                            className="grid h-8 w-8 place-items-center rounded-lg bg-bg-muted text-text-secondary hover:bg-bg-overlay"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      <span className="ml-auto shrink-0 text-sm font-bold text-accent-gold sm:ml-0 sm:w-24 sm:text-right">
                        {formatCurrency(
                          calculateBudgetItemSubtotal(
                            item.service.name,
                            item.service.defaultValue,
                            item.quantity,
                            item.unitPriceOverride,
                          ),
                        )}
                      </span>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.service._id)}
                        aria-label={`Remover ${item.service.name}`}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-accent-red transition hover:bg-accent-red/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 text-sm font-bold">
                  <span>Subtotal</span>
                  <span className="text-accent-gold">{formatCurrency(itemsTotal)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold">Deslocamento</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Endereço de destino a partir do endereço de partida cadastrado nas configurações.
              </p>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm text-text-secondary">Endereço de destino</span>
              <input
                type="text"
                maxLength={300}
                value={destinationAddress}
                onChange={(e) => setDestinationAddress(e.target.value)}
                className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold"
              />
            </label>

            {calculateDistanceMutation.isPending ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-border-default py-10 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-accent-gold" />
                <p className="text-sm text-text-secondary">Calculando distância...</p>
              </div>
            ) : (
              <>
                {calculateDistanceMutation.isError && (
                  <div className="rounded-xl bg-accent-red/10 p-3 text-sm text-accent-red">
                    {getApiErrorMessages(calculateDistanceMutation.error, "Não foi possível calcular a distância.")[0]}
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={!destinationAddress.trim()}
                    onClick={() => {
                      setSkipDistance(false);
                      calculateDistanceMutation.mutate();
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-gold px-4 py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <MapPin className="h-4 w-4" />
                    Calcular deslocamento
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSkipDistance(true);
                      setDistancePreview(null);
                      setStep(4);
                    }}
                    className="rounded-xl border border-border-default bg-transparent px-4 py-3 text-sm font-semibold text-text-secondary transition hover:bg-bg-overlay"
                  >
                    Pular deslocamento
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {step === 4 && selectedClient && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold">Revisão</h2>
              <p className="mt-1 text-sm text-text-secondary">Confira os dados antes de gerar o orçamento.</p>
            </div>

            <div className="rounded-xl bg-bg-muted/50 p-4 text-sm">
              <p className="font-bold text-white">{selectedClient.name}</p>
              <p className="text-text-secondary">{selectedClient.address}</p>
            </div>

            <div className="space-y-1">
              {cart.map((item) => (
                <div key={item.service._id} className="flex justify-between text-sm">
                  <span className="text-text-secondary">
                    {isPanelCleaningService(item.service.name)
                      ? `${item.quantity} ${item.quantity === 1 ? "placa" : "placas"} · ${item.service.name}`
                      : `${item.quantity}x ${item.service.name}`}
                  </span>
                  <span className="font-semibold">
                    {formatCurrency(
                      calculateBudgetItemSubtotal(
                        item.service.name,
                        item.service.defaultValue,
                        item.quantity,
                        item.unitPriceOverride,
                      ),
                    )}
                  </span>
                </div>
              ))}
              {!skipDistance && distancePreview && (
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">
                    Deslocamento ({(distancePreview.distanceKm * 2).toFixed(1)} km ida e volta)
                  </span>
                  <span className="font-semibold">{formatCurrency(distancePreview.travelCost)}</span>
                </div>
              )}
            </div>

            {/* Endereços homônimos são comuns (existem várias "Praia da Baleia" no país), então o
                ponto escolhido pelo mapa fica visível aqui para conferência antes de gerar o orçamento. */}
            {!skipDistance && distancePreview?.resolvedDestination && (
              <div className="rounded-xl border border-border-default bg-bg-muted/30 p-4">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent-gold" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text-secondary">Destino localizado no mapa</p>
                    <p className="mt-1 break-words text-sm text-text-primary">
                      {distancePreview.resolvedDestination.label}
                    </p>
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${distancePreview.resolvedDestination.lat}&mlon=${distancePreview.resolvedDestination.lon}#map=15/${distancePreview.resolvedDestination.lat}/${distancePreview.resolvedDestination.lon}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs text-accent-gold underline underline-offset-2 hover:brightness-110"
                    >
                      {distancePreview.resolvedDestination.lat.toFixed(6)},{" "}
                      {distancePreview.resolvedDestination.lon.toFixed(6)} · ver no mapa
                    </a>
                    <p className="mt-2 text-xs text-text-muted">
                      Não é esse o lugar? Volte e informe o endereço com mais detalhes (bairro, cidade e estado).
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm text-text-secondary">Desconto (opcional)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discount || ""}
                  onChange={(e) => setDiscount(Number(e.target.value) || 0)}
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
              <span className="mb-1 block text-sm text-text-secondary">Observações (opcional)</span>
              <textarea
                rows={panelCleaningNote ? 4 : 2}
                maxLength={1000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full resize-y rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold"
              />
              {panelCleaningNote && (
                <p className="mt-1 text-xs text-text-muted">
                  A memória de cálculo da limpeza de placas foi adicionada automaticamente. Você pode editá-la.
                </p>
              )}
            </label>

            <div className="flex items-center justify-between rounded-xl bg-bg-muted px-5 py-4">
              <span className="text-sm font-semibold text-text-secondary">Total</span>
              <span className="font-sans text-2xl font-extrabold text-accent-gold">{formatCurrency(total)}</span>
            </div>

            {createError && <div className="rounded-xl bg-accent-red/10 p-3 text-sm text-accent-red">{createError}</div>}
          </div>
        )}

        {step === 5 && createdBudget && (
          <div className="flex flex-col items-center gap-5 py-4 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-accent-green/10">
              <CheckCircle2 className="h-9 w-9 text-accent-green" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-accent-gold">
                Orçamento #{String(createdBudget.sequenceNumber).padStart(4, "0")}
              </p>
              <h2 className="mt-1 text-xl font-bold">Orçamento criado com sucesso</h2>
              <p className="mt-1 text-sm text-text-secondary">{selectedClient?.name}</p>
            </div>
            <div className="flex w-full max-w-sm items-center justify-between rounded-xl bg-bg-muted px-5 py-4">
              <span className="text-sm font-semibold text-text-secondary">Total</span>
              <span className="font-sans text-2xl font-extrabold text-accent-gold">
                {formatCurrency(createdBudget.total)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => downloadPdfMutation.mutate(createdBudget)}
              disabled={downloadPdfMutation.isPending}
              className="flex w-full max-w-sm items-center justify-center gap-2 rounded-full bg-accent-gold px-6 py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-70"
            >
              {downloadPdfMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Baixar PDF do orçamento
            </button>
            <Link to="/orcamentos" className="text-sm font-semibold text-text-secondary hover:text-text-primary">
              Voltar para a lista de orçamentos
            </Link>
          </div>
        )}
      </div>

      {step < 5 && (
        <div className="flex max-w-2xl items-center justify-between border-t border-border-default pt-4">
          <button
            type="button"
            onClick={() => (step === 1 ? navigate("/orcamentos") : goBack())}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar
          </button>

          {step === 1 && (
            <button
              type="button"
              disabled={!selectedClient}
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 rounded-full bg-accent-gold px-6 py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continuar
              <ChevronRight className="h-4 w-4" />
            </button>
          )}

          {step === 2 && (
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-2 rounded-full bg-accent-gold px-6 py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continuar
              <ChevronRight className="h-4 w-4" />
            </button>
          )}

          {step === 4 && (
            <button
              type="button"
              disabled={createBudgetMutation.isPending}
              onClick={() => createBudgetMutation.mutate()}
              className="inline-flex items-center gap-2 rounded-full bg-accent-gold px-6 py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {createBudgetMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar orçamento
            </button>
          )}
        </div>
      )}

      <ClientFormModal
        open={clientModalOpen}
        onClose={() => setClientModalOpen(false)}
        onSaved={(client) => {
          setClientModalOpen(false);
          selectClient(client);
        }}
      />

      <PanelQuantityModal
        open={panelModalService !== null}
        serviceName={panelModalService?.name ?? ""}
        initialQuantity={
          cart.find((item) => item.service._id === panelModalService?._id)?.quantity ?? 1
        }
        onClose={() => setPanelModalService(null)}
        onConfirm={(quantity) => {
          if (panelModalService) setPanelQuantity(panelModalService, quantity);
        }}
      />
    </section>
  );
}
