import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CalendarDays, ChevronDown, ChevronLeft, ChevronUp, Loader2, Plus } from "lucide-react";

import { api } from "../../lib/api";
import { formatCurrency } from "../../lib/finance";
import { getApiErrorMessages } from "../../lib/errors";
import {
  formatFullDate,
  formatWeekdayShort,
  isToday,
  isWorkingDay,
  toDateKey,
} from "../../lib/agenda";
import { CurrencyInput } from "../ui/CurrencyInput";
import { DurationPicker } from "../agenda/DurationPicker";
import { MonthCalendar } from "../agenda/MonthCalendar";
import { ModalShell } from "./ModalShell";
import { ServiceFormModal } from "./ServiceFormModal";
import { cn } from "../../lib/utils";
import type { AvailabilityResponse, Service } from "../../types/api";

function nextCandidateDays(count: number): Date[] {
  const days: Date[] = [];
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);
  while (days.length < count) {
    if (isWorkingDay(cursor)) days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

type WizardStep = 1 | 2 | 3 | 4;

export function AppointmentWizardModal({
  open,
  onClose,
  initialDate,
}: {
  open: boolean;
  onClose: () => void;
  initialDate?: string;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<WizardStep>(1);
  const [service, setService] = useState<Service | null>(null);
  const [dateKey, setDateKey] = useState<string>(initialDate ?? toDateKey(new Date()));
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [chargedValue, setChargedValue] = useState(0);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setService(null);
    setDateKey(initialDate ?? toDateKey(new Date()));
    setDurationMinutes(60);
    setStartTime(null);
    setChargedValue(0);
    setClientName("");
    setClientPhone("");
    setError(null);
    setServiceModalOpen(false);
    setCalendarOpen(false);
    setCalendarMonth(new Date());
  }, [open, initialDate]);

  const candidateDays = useMemo(() => nextCandidateDays(14), []);

  const servicesQuery = useQuery<Service[]>({
    queryKey: ["services", "active"],
    queryFn: () => api.get<Service[]>("/api/services?activeOnly=true").then((r) => r.data),
    enabled: open && step === 1,
  });

  const dayFullnessQuery = useQuery<Record<string, boolean>>({
    queryKey: ["appointments-day-fullness", candidateDays.map(toDateKey).join(",")],
    queryFn: async () => {
      const entries = await Promise.all(
        candidateDays.map(async (day) => {
          const key = toDateKey(day);
          const { data } = await api.get<AvailabilityResponse>("/api/appointments/availability", {
            params: { date: key },
          });
          return [key, data.slots.length === 0] as const;
        }),
      );
      return Object.fromEntries(entries);
    },
    enabled: open && step === 2,
  });

  const availabilityQuery = useQuery<AvailabilityResponse>({
    queryKey: ["appointments-availability", dateKey, durationMinutes],
    queryFn: () =>
      api
        .get<AvailabilityResponse>("/api/appointments/availability", {
          params: { date: dateKey, durationMinutes },
        })
        .then((r) => r.data),
    enabled: open && step === 3,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!service || !startTime) return;
      await api.post("/api/appointments", {
        serviceId: service._id,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim() || undefined,
        startAt: `${dateKey}T${startTime}:00.000Z`,
        durationMinutes,
        chargedValue,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-accounts-receivable"] });
      queryClient.invalidateQueries({ queryKey: ["agenda-reports-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["agenda-reports-daily-summary"] });
      onClose();
    },
    onError: (err) => {
      setError(getApiErrorMessages(err, "Não foi possível criar o agendamento.")[0]);
    },
  });

  const selectService = (s: Service) => {
    setService(s);
    setChargedValue(s.defaultValue);
    setStep(2);
  };

  const selectDate = (key: string) => {
    setDateKey(key);
    setStartTime(null);
    setStep(3);
  };

  const selectTime = (time: string) => {
    setStartTime(time);
    setStep(4);
  };

  const goBack = () => {
    setError(null);
    setStep((s) => (s > 1 ? ((s - 1) as WizardStep) : s));
  };

  const stepTitles: Record<WizardStep, string> = {
    1: "1. Escolha o serviço",
    2: "2. Escolha o dia",
    3: "3. Escolha o horário",
    4: "4. Dados do cliente",
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Novo Agendamento"
      icon={<CalendarCheck className="h-6 w-6 text-accent-gold" />}
      containerClassName="max-w-xl"
      footer={
        step === 4 ? (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={goBack}
              className="flex-1 rounded-xl border border-bg-muted bg-transparent px-5 py-3 text-sm font-bold text-white transition hover:bg-bg-overlay"
            >
              Voltar
            </button>
            <button
              type="submit"
              form="wizard-step-4"
              disabled={createMutation.isPending || !clientName.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-gold px-5 py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar Agendamento
            </button>
          </div>
        ) : step > 1 ? (
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-2 rounded-xl border border-bg-muted bg-transparent px-5 py-3 text-sm font-bold text-white transition hover:bg-bg-overlay"
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar
          </button>
        ) : undefined
      }
    >
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-text-secondary">{stepTitles[step]}</p>

      {step === 1 && (
        <div className="space-y-2">
          {servicesQuery.isLoading ? (
            <p className="text-sm text-text-secondary">Carregando serviços...</p>
          ) : (servicesQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-text-secondary">
              Nenhum serviço ativo cadastrado. Cadastre um serviço para poder agendá-lo.
            </p>
          ) : (
            (servicesQuery.data ?? []).map((s) => (
              <button
                key={s._id}
                type="button"
                onClick={() => selectService(s)}
                className="flex w-full items-center justify-between rounded-xl bg-bg-muted px-4 py-3 text-left transition hover:bg-bg-overlay"
              >
                <span className="font-semibold text-white">{s.name}</span>
                <span className="text-sm font-bold text-accent-gold">{formatCurrency(s.defaultValue)}</span>
              </button>
            ))
          )}
          <button
            type="button"
            onClick={() => setServiceModalOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-bg-muted px-4 py-3 text-sm font-semibold text-text-secondary transition hover:border-accent-gold hover:text-accent-gold"
          >
            <Plus className="h-4 w-4" />
            Novo Serviço
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {candidateDays.map((day) => {
              const key = toDateKey(day);
              const full = dayFullnessQuery.data?.[key];
              return (
                <button
                  key={key}
                  type="button"
                  disabled={full}
                  onClick={() => selectDate(key)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-xl px-1 py-2.5 transition",
                    full
                      ? "cursor-not-allowed bg-bg-muted/40 text-text-muted opacity-50"
                      : "bg-bg-muted text-white hover:bg-bg-overlay",
                  )}
                >
                  <span className="text-[10px] font-semibold uppercase">{formatWeekdayShort(day)}</span>
                  <span className="text-base font-bold">{day.getUTCDate()}</span>
                  {isToday(day) && <span className="text-[9px] text-accent-gold">Hoje</span>}
                  {full && <span className="text-[9px] text-accent-red">Cheio</span>}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setCalendarOpen((v) => !v)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-bg-muted px-4 py-2.5 text-sm font-semibold text-text-secondary transition hover:border-accent-gold hover:text-accent-gold"
          >
            <CalendarDays className="h-4 w-4" />
            Ver calendário completo
            {calendarOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {calendarOpen && (
            <MonthCalendar
              monthAnchor={calendarMonth}
              selectedDate={dateKey}
              onSelectDate={selectDate}
              onMonthChange={setCalendarMonth}
            />
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <DurationPicker value={durationMinutes} onChange={setDurationMinutes} />

          {availabilityQuery.isLoading ? (
            <p className="text-sm text-text-secondary">Carregando horários...</p>
          ) : (availabilityQuery.data?.slots ?? []).length === 0 ? (
            <p className="text-sm text-text-secondary">Nenhum horário disponível para essa duração neste dia.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {(availabilityQuery.data?.slots ?? []).map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => selectTime(slot)}
                  className="rounded-xl bg-bg-muted px-2 py-2 text-sm font-semibold text-white transition hover:bg-bg-overlay"
                >
                  {slot}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 4 && service && startTime && (
        <form
          id="wizard-step-4"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <div className="rounded-2xl border border-bg-muted bg-bg-muted/50 p-4 text-sm">
            <p className="font-semibold text-white">{service.name}</p>
            <p className="mt-1 text-text-secondary capitalize">{formatFullDate(new Date(`${dateKey}T00:00:00.000Z`))}</p>
            <p className="text-text-secondary">
              {startTime} · {durationMinutes} min
            </p>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm text-text-secondary">Nome do cliente</span>
            <input
              type="text"
              maxLength={150}
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nome completo"
              className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-text-secondary">Telefone (opcional)</span>
            <input
              type="tel"
              maxLength={30}
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-text-secondary">Valor cobrado</span>
            <CurrencyInput
              value={chargedValue}
              onChange={setChargedValue}
              className="w-full rounded-xl border border-bg-muted bg-bg-muted px-4 py-3 text-white outline-none focus:border-accent-gold"
            />
          </label>

          {error && <div className="rounded-xl bg-accent-red/10 p-3 text-sm text-accent-red">{error}</div>}
        </form>
      )}

      <ServiceFormModal
        open={serviceModalOpen}
        service={null}
        onClose={() => setServiceModalOpen(false)}
        onSaved={(saved) => {
          setServiceModalOpen(false);
          selectService(saved);
        }}
      />
    </ModalShell>
  );
}
