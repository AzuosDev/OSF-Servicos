import { Phone } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatCurrency } from "../../lib/finance";
import { formatTimeUtc, paymentStatusClasses, paymentStatusLabels } from "../../lib/agenda";
import type { Appointment } from "../../types/api";

export function AppointmentCard({
  appointment,
  serviceName,
  onClick,
}: {
  appointment: Appointment;
  serviceName: string;
  onClick: () => void;
}) {
  const cancelled = appointment.status === "CANCELADO";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full flex-wrap items-center gap-3 rounded-2xl border bg-bg-card p-4 text-left transition hover:bg-bg-overlay",
        cancelled ? "border-bg-muted opacity-50" : "border-bg-muted",
      )}
    >
      <div className="shrink-0 text-sm font-bold text-white">
        {formatTimeUtc(appointment.startAt)} - {formatTimeUtc(appointment.endAt)}
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-semibold", cancelled ? "text-text-secondary line-through" : "text-white")}>
          {serviceName}
        </p>
        <p className="flex items-center gap-1 truncate text-xs text-text-secondary">
          {appointment.clientName}
          {appointment.clientPhone && (
            <>
              <Phone className="h-3 w-3 shrink-0" />
              {appointment.clientPhone}
            </>
          )}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-bold text-white">{formatCurrency(appointment.chargedValue)}</p>
        <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold", paymentStatusClasses[appointment.paymentStatus])}>
          {cancelled ? "Cancelado" : paymentStatusLabels[appointment.paymentStatus]}
        </span>
      </div>
    </button>
  );
}
