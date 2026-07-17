import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Pencil,
  Phone,
  User,
  XCircle,
} from "lucide-react";

import { api } from "../../lib/api";
import { formatCurrency } from "../../lib/finance";
import { getApiErrorMessages } from "../../lib/errors";
import {
  appointmentStatusLabels,
  formatFullDate,
  formatTimeUtc,
  paymentStatusClasses,
  paymentStatusLabels,
  toDateKey,
} from "../../lib/agenda";
import { CurrencyInput } from "../ui/CurrencyInput";
import { DurationPicker } from "../agenda/DurationPicker";
import { ModalShell } from "./ModalShell";
import { useToast } from "../ui/Toast";
import { cn } from "../../lib/utils";
import type { Appointment, AppointmentPaymentMethod, Service } from "../../types/api";

type Mode = "view" | "edit" | "reschedule" | "payment";

const paymentMethodOptions: { value: AppointmentPaymentMethod; label: string }[] = [
  { value: "PIX", label: "PIX" },
  { value: "DINHEIRO", label: "Dinheiro" },
  { value: "CARTAO", label: "Cartão" },
];

export function AppointmentDetailsModal({
  open,
  appointmentId,
  onClose,
}: {
  open: boolean;
  appointmentId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [mode, setMode] = useState<Mode>("view");
  const [error, setError] = useState<string | null>(null);

  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editValue, setEditValue] = useState(0);

  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleDuration, setRescheduleDuration] = useState(60);

  const [paymentMethod, setPaymentMethod] = useState<AppointmentPaymentMethod>("PIX");
  const [paymentValue, setPaymentValue] = useState(0);

  useEffect(() => {
    if (open) {
      setMode("view");
      setError(null);
    }
  }, [open, appointmentId]);

  const appointmentQuery = useQuery<Appointment>({
    queryKey: ["appointment", appointmentId],
    queryFn: () => api.get<Appointment>(`/api/appointments/${appointmentId}`).then((r) => r.data),
    enabled: open && Boolean(appointmentId),
  });

  const appointment = appointmentQuery.data;

  const serviceQuery = useQuery<Service>({
    queryKey: ["service", appointment?.serviceId],
    queryFn: () => api.get<Service>(`/api/services/${appointment!.serviceId}`).then((r) => r.data),
    enabled: open && Boolean(appointment?.serviceId),
  });

  useEffect(() => {
    if (!appointment) return;
    setEditName(appointment.clientName);
    setEditPhone(appointment.clientPhone ?? "");
    setEditValue(appointment.chargedValue);
    setRescheduleDate(toDateKey(new Date(appointment.startAt)));
    setRescheduleTime(formatTimeUtc(appointment.startAt));
    setRescheduleDuration(appointment.durationMinutes);
    setPaymentValue(Math.max(0, appointment.chargedValue - appointment.totalPaid));
  }, [appointment]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["appointment", appointmentId] });
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
    queryClient.invalidateQueries({ queryKey: ["appointments-accounts-receivable"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["agenda-reports-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["agenda-reports-daily-summary"] });
  };

  const editMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/api/appointments/${appointmentId}`, {
        clientName: editName.trim(),
        clientPhone: editPhone.trim() || undefined,
        chargedValue: editValue,
      });
    },
    onSuccess: () => {
      invalidateAll();
      addToast("Agendamento atualizado com sucesso.", "success");
      setMode("view");
    },
    onError: (err) => setError(getApiErrorMessages(err, "Não foi possível salvar as alterações.")[0]),
  });

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/api/appointments/${appointmentId}/reschedule`, {
        startAt: `${rescheduleDate}T${rescheduleTime}:00.000Z`,
        durationMinutes: rescheduleDuration,
      });
    },
    onSuccess: () => {
      invalidateAll();
      addToast("Agendamento reagendado com sucesso.", "success");
      setMode("view");
    },
    onError: (err) => setError(getApiErrorMessages(err, "Não foi possível reagendar.")[0]),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/api/appointments/${appointmentId}/cancel`);
    },
    onSuccess: () => {
      invalidateAll();
      addToast("Agendamento cancelado.", "success");
      setMode("view");
    },
    onError: (err) => addToast(getApiErrorMessages(err, "Não foi possível cancelar.")[0], "error"),
  });

  const finishMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/api/appointments/${appointmentId}/finish`);
    },
    onSuccess: () => {
      invalidateAll();
      addToast("Serviço finalizado.", "success");
      setMode("view");
    },
    onError: (err) => addToast(getApiErrorMessages(err, "Não foi possível finalizar.")[0], "error"),
  });

  const paymentMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/api/appointments/${appointmentId}/payments`, {
        method: paymentMethod,
        value: paymentValue,
      });
    },
    onSuccess: () => {
      invalidateAll();
      addToast("Pagamento registrado com sucesso.", "success");
      setMode("view");
    },
    onError: (err) => setError(getApiErrorMessages(err, "Não foi possível registrar o pagamento.")[0]),
  });

  if (!open || !appointmentId) return null;

  const pendingValue = appointment ? Math.max(0, appointment.chargedValue - appointment.totalPaid) : 0;
  const canOperate = appointment && appointment.status !== "CANCELADO" && appointment.status !== "FINALIZADO";

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Detalhes do Agendamento"
      icon={<ClipboardList className="h-6 w-6 text-accent-lime" />}
      footer={
        mode === "view" ? undefined : (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setMode("view")}
              className="flex-1 rounded-xl border border-bg-muted bg-transparent px-5 py-3 text-sm font-bold text-white transition hover:bg-bg-overlay"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form={`details-form-${mode}`}
              disabled={editMutation.isPending || rescheduleMutation.isPending || paymentMutation.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-lime px-5 py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {(editMutation.isPending || rescheduleMutation.isPending || paymentMutation.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Salvar
            </button>
          </div>
        )
      }
    >
      {!appointment ? (
        <p className="text-sm text-text-secondary">Carregando...</p>
      ) : mode === "view" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-bg-muted px-3 py-1 text-xs font-semibold text-white">
              {appointmentStatusLabels[appointment.status]}
            </span>
            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", paymentStatusClasses[appointment.paymentStatus])}>
              {paymentStatusLabels[appointment.paymentStatus]}
            </span>
          </div>

          <div className="rounded-2xl border border-bg-muted bg-bg-muted/40 p-4 text-sm">
            <p className="font-semibold text-white">{serviceQuery.data?.name ?? "Serviço"}</p>
            <p className="mt-1 flex items-center gap-2 text-text-secondary">
              <User className="h-3.5 w-3.5" /> {appointment.clientName}
            </p>
            {appointment.clientPhone && (
              <p className="flex items-center gap-2 text-text-secondary">
                <Phone className="h-3.5 w-3.5" /> {appointment.clientPhone}
              </p>
            )}
            <p className="mt-2 flex items-center gap-2 text-text-secondary capitalize">
              <CalendarClock className="h-3.5 w-3.5" />
              {formatFullDate(new Date(appointment.startAt))} · {formatTimeUtc(appointment.startAt)} -{" "}
              {formatTimeUtc(appointment.endAt)} ({appointment.durationMinutes} min)
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-bg-muted/40 p-3">
              <p className="text-[10px] uppercase text-text-secondary">Total</p>
              <p className="mt-1 text-sm font-bold text-white">{formatCurrency(appointment.chargedValue)}</p>
            </div>
            <div className="rounded-xl bg-bg-muted/40 p-3">
              <p className="text-[10px] uppercase text-text-secondary">Recebido</p>
              <p className="mt-1 text-sm font-bold text-accent-lime">{formatCurrency(appointment.totalPaid)}</p>
            </div>
            <div className="rounded-xl bg-bg-muted/40 p-3">
              <p className="text-[10px] uppercase text-text-secondary">Pendente</p>
              <p className="mt-1 text-sm font-bold text-accent-red">{formatCurrency(pendingValue)}</p>
            </div>
          </div>

          {appointment.payments.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-text-secondary">Pagamentos realizados</p>
              <div className="space-y-1.5">
                {appointment.payments.map((p, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-bg-muted/40 px-3 py-2 text-sm">
                    <span className="text-text-secondary">{paymentMethodOptions.find((m) => m.value === p.method)?.label}</span>
                    <span className="font-semibold text-white">{formatCurrency(p.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {canOperate && (
            <div className="flex flex-wrap gap-2 pt-2">
              {pendingValue > 0 && (
                <button
                  type="button"
                  onClick={() => setMode("payment")}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent-lime px-3 py-2 text-xs font-bold text-black transition hover:brightness-110"
                >
                  <Banknote className="h-4 w-4" /> Registrar pagamento
                </button>
              )}
              <button
                type="button"
                onClick={() => setMode("edit")}
                className="inline-flex items-center gap-2 rounded-xl bg-bg-muted px-3 py-2 text-xs font-semibold text-white transition hover:bg-bg-overlay"
              >
                <Pencil className="h-4 w-4" /> Editar
              </button>
              <button
                type="button"
                onClick={() => setMode("reschedule")}
                className="inline-flex items-center gap-2 rounded-xl bg-bg-muted px-3 py-2 text-xs font-semibold text-white transition hover:bg-bg-overlay"
              >
                <CalendarClock className="h-4 w-4" /> Reagendar
              </button>
              <button
                type="button"
                onClick={() => finishMutation.mutate()}
                disabled={finishMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-bg-muted px-3 py-2 text-xs font-semibold text-white transition hover:bg-bg-overlay disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" /> Finalizar serviço
              </button>
              <button
                type="button"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="inline-flex items-center gap-2 rounded-xl border border-accent-red/30 px-3 py-2 text-xs font-semibold text-accent-red transition hover:bg-accent-red/10 disabled:opacity-60"
              >
                <XCircle className="h-4 w-4" /> Cancelar
              </button>
            </div>
          )}
        </div>
      ) : mode === "edit" ? (
        <form
          id="details-form-edit"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            editMutation.mutate();
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm text-text-secondary">Nome do cliente</span>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-lime"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-text-secondary">Telefone</span>
            <input
              type="tel"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-lime"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-text-secondary">Valor cobrado</span>
            <CurrencyInput
              value={editValue}
              onChange={setEditValue}
              className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-lime"
            />
          </label>
          {error && <div className="rounded-xl bg-accent-red/10 p-3 text-sm text-accent-red">{error}</div>}
        </form>
      ) : mode === "reschedule" ? (
        <form
          id="details-form-reschedule"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            rescheduleMutation.mutate();
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm text-text-secondary">Data</span>
            <input
              type="date"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-lime"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-text-secondary">Hora de início</span>
            <input
              type="time"
              value={rescheduleTime}
              onChange={(e) => setRescheduleTime(e.target.value)}
              className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-lime"
            />
          </label>
          <DurationPicker value={rescheduleDuration} onChange={setRescheduleDuration} />
          {error && <div className="rounded-xl bg-accent-red/10 p-3 text-sm text-accent-red">{error}</div>}
        </form>
      ) : (
        <form
          id="details-form-payment"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            paymentMutation.mutate();
          }}
        >
          <div className="flex gap-2">
            {paymentMethodOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPaymentMethod(opt.value)}
                className={cn(
                  "flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition",
                  paymentMethod === opt.value
                    ? "bg-accent-lime text-black"
                    : "bg-bg-muted text-text-secondary hover:bg-bg-overlay hover:text-white",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="mb-1 block text-sm text-text-secondary">
              Valor (pendente: {formatCurrency(pendingValue)})
            </span>
            <CurrencyInput
              value={paymentValue}
              onChange={setPaymentValue}
              className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-lime"
            />
          </label>
          {error && <div className="rounded-xl bg-accent-red/10 p-3 text-sm text-accent-red">{error}</div>}
        </form>
      )}
    </ModalShell>
  );
}
