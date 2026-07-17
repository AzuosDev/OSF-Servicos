import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleDollarSign, Phone } from "lucide-react";

import { api } from "../lib/api";
import { formatCurrency } from "../lib/finance";
import { formatFullDate, paymentStatusClasses, paymentStatusLabels } from "../lib/agenda";
import { AppointmentDetailsModal } from "../components/modals/AppointmentDetailsModal";
import type { Appointment, Service } from "../types/api";

export function ContasReceberPage() {
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const receivableQuery = useQuery<Appointment[]>({
    queryKey: ["appointments-accounts-receivable"],
    queryFn: () => api.get<Appointment[]>("/api/appointments/accounts-receivable").then((r) => r.data),
  });

  const servicesQuery = useQuery<Service[]>({
    queryKey: ["services"],
    queryFn: () => api.get<Service[]>("/api/services").then((r) => r.data),
  });

  const serviceNameById = useMemo(() => {
    const map = new Map<string, string>();
    (servicesQuery.data ?? []).forEach((s) => map.set(s._id, s.name));
    return map;
  }, [servicesQuery.data]);

  const items = receivableQuery.data ?? [];
  const totalPending = items.reduce((sum, a) => sum + Math.max(0, a.chargedValue - a.totalPaid), 0);

  return (
    <section className="space-y-5">
      <header>
        <p className="text-sm text-text-secondary">Estética Automotiva</p>
        <h1 className="font-sans text-3xl font-bold">Contas a Receber</h1>
      </header>

      <div className="rounded-2xl bg-bg-card p-4">
        <p className="text-xs uppercase tracking-wide text-text-secondary">Total pendente</p>
        <p className="mt-2 text-2xl font-bold text-accent-red">{formatCurrency(totalPending)}</p>
      </div>

      {receivableQuery.isLoading ? (
        <div className="rounded-2xl border border-bg-muted bg-bg-card p-5 text-sm text-text-secondary">
          Carregando...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-bg-muted bg-bg-card p-8 text-center">
          <CircleDollarSign className="mx-auto h-10 w-10 text-accent-lime" />
          <h2 className="mt-4 text-xl font-semibold text-white">Nenhuma conta pendente</h2>
          <p className="mt-2 text-sm text-text-secondary">Todos os serviços agendados estão com o pagamento em dia.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((a) => {
            const pending = Math.max(0, a.chargedValue - a.totalPaid);
            return (
              <button
                key={a._id}
                type="button"
                onClick={() => setDetailsId(a._id)}
                className="flex w-full flex-wrap items-center gap-3 rounded-2xl border border-bg-muted bg-bg-card p-4 text-left transition hover:bg-bg-overlay"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{a.clientName}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-text-secondary">
                    {serviceNameById.get(a.serviceId) ?? "Serviço"}
                    {a.clientPhone && (
                      <>
                        <Phone className="h-3 w-3 shrink-0" />
                        {a.clientPhone}
                      </>
                    )}
                  </p>
                  <p className="text-xs text-text-secondary capitalize">{formatFullDate(new Date(a.startAt))}</p>
                </div>

                <div className="shrink-0 text-right text-sm">
                  <p className="text-text-secondary">
                    Total: <span className="font-semibold text-white">{formatCurrency(a.chargedValue)}</span>
                  </p>
                  <p className="text-text-secondary">
                    Recebido: <span className="font-semibold text-accent-lime">{formatCurrency(a.totalPaid)}</span>
                  </p>
                  <p className="text-text-secondary">
                    Restante: <span className="font-semibold text-accent-red">{formatCurrency(pending)}</span>
                  </p>
                </div>

                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${paymentStatusClasses[a.paymentStatus]}`}>
                  {paymentStatusLabels[a.paymentStatus]}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <AppointmentDetailsModal open={Boolean(detailsId)} appointmentId={detailsId} onClose={() => setDetailsId(null)} />
    </section>
  );
}
