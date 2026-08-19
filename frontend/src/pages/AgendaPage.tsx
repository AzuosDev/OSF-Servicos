import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarX2, Plus, Wrench } from "lucide-react";

import { api } from "../lib/api";
import { WeekDayNav } from "../components/agenda/WeekDayNav";
import { AppointmentCard } from "../components/agenda/AppointmentCard";
import { AppointmentWizardModal } from "../components/modals/AppointmentWizardModal";
import { AppointmentDetailsModal } from "../components/modals/AppointmentDetailsModal";
import {
  buildPrevWorkingWindow,
  buildWorkingWindow,
  formatFullDate,
  formatWeekdayLong,
  isToday,
  nextWindowStart,
  parseDateKey,
  toDateKey,
} from "../lib/agenda";
import type { Appointment, Service } from "../types/api";

export function AgendaPage() {
  const [weekWindow, setWeekWindow] = useState<Date[]>(() => buildWorkingWindow(new Date()));
  const [selectedDate, setSelectedDate] = useState<string>(() => toDateKey(weekWindow[0] ?? new Date()));
  const [wizardOpen, setWizardOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const selectedDay = useMemo(() => new Date(`${selectedDate}T00:00:00.000Z`), [selectedDate]);

  const appointmentsQuery = useQuery<Appointment[]>({
    queryKey: ["appointments", selectedDate],
    queryFn: () => api.get<Appointment[]>("/api/appointments", { params: { date: selectedDate } }).then((r) => r.data),
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

  const appointments = appointmentsQuery.data ?? [];

  const handlePrev = () => setWeekWindow((current) => buildPrevWorkingWindow(current[0]));
  const handleNext = () => setWeekWindow((current) => buildWorkingWindow(nextWindowStart(current)));
  const handleJumpToDate = (dateKey: string) => {
    setWeekWindow(buildWorkingWindow(parseDateKey(dateKey)));
    setSelectedDate(dateKey);
  };

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-text-secondary">Estética Automotiva</p>
          <h1 className="font-sans text-3xl font-bold">Agenda</h1>
        </div>
        <Link
          to="/servicos"
          className="inline-flex items-center gap-2 rounded-xl bg-bg-muted px-4 py-3 text-sm font-semibold text-white transition hover:bg-bg-overlay"
        >
          <Wrench className="h-4 w-4" />
          Serviços
        </Link>
      </header>

      <WeekDayNav
        days={weekWindow}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onPrev={handlePrev}
        onNext={handleNext}
        onJumpToDate={handleJumpToDate}
      />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-semibold capitalize text-white">
            {formatWeekdayLong(selectedDay)}, {formatFullDate(selectedDay)}
          </p>
          {isToday(selectedDay) && <p className="text-xs font-semibold text-accent-gold">Hoje</p>}
        </div>
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-accent-gold px-4 py-3 text-sm font-bold text-black transition hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          Novo Agendamento
        </button>
      </div>

      {appointmentsQuery.isLoading ? (
        <div className="rounded-2xl border border-bg-muted bg-bg-card p-5 text-sm text-text-secondary">
          Carregando agendamentos...
        </div>
      ) : appointments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-bg-muted bg-bg-card p-8 text-center">
          <CalendarX2 className="mx-auto h-10 w-10 text-text-muted" />
          <h2 className="mt-4 text-xl font-semibold text-white">Nenhum agendamento</h2>
          <p className="mt-2 text-sm text-text-secondary">Não há agendamentos para este dia.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {appointments.map((a) => (
            <AppointmentCard
              key={a._id}
              appointment={a}
              serviceName={serviceNameById.get(a.serviceId) ?? "Serviço"}
              onClick={() => setDetailsId(a._id)}
            />
          ))}
        </div>
      )}

      <AppointmentWizardModal open={wizardOpen} onClose={() => setWizardOpen(false)} initialDate={selectedDate} />
      <AppointmentDetailsModal open={Boolean(detailsId)} appointmentId={detailsId} onClose={() => setDetailsId(null)} />
    </section>
  );
}
