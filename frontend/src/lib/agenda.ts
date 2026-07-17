import type { AppointmentPaymentStatus, AppointmentStatus } from "../types/api";

// Datas do módulo Agenda são tratadas em UTC (mesma convenção do resto do app:
// dueDate/generatedDate são "meia-noite UTC" e exibidos com timeZone: 'UTC').
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function isWorkingDay(date: Date): boolean {
  return date.getUTCDay() !== 0; // domingo não é dia útil
}

export function buildWorkingWindow(start: Date, count = 6): Date[] {
  const days: Date[] = [];
  const cursor = new Date(start);
  while (days.length < count) {
    if (isWorkingDay(cursor)) days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export function buildPrevWorkingWindow(currentStart: Date, count = 6): Date[] {
  const days: Date[] = [];
  const cursor = new Date(currentStart);
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (days.length < count) {
    if (isWorkingDay(cursor)) days.unshift(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return days;
}

export function nextWindowStart(currentWindow: Date[]): Date {
  const last = currentWindow[currentWindow.length - 1];
  const next = new Date(last);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" });
const weekdayLongFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" });
const monthYearFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const fullDateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", timeZone: "UTC" });

export function formatWeekdayShort(date: Date): string {
  return weekdayFormatter.format(date).replace(".", "");
}

export function formatWeekdayLong(date: Date): string {
  const label = weekdayLongFormatter.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatMonthYear(date: Date): string {
  const label = monthYearFormatter.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatFullDate(date: Date): string {
  return fullDateFormatter.format(date);
}

export function isToday(date: Date): boolean {
  return toDateKey(date) === toDateKey(new Date());
}

// Extrai HH:mm de um datetime ISO em UTC (sem conversão de fuso).
export function formatTimeUtc(isoDate: string): string {
  return isoDate.slice(11, 16);
}

export const paymentStatusLabels: Record<AppointmentPaymentStatus, string> = {
  NAO_PAGO: "Não pago",
  PARCIALMENTE_PAGO: "Parcialmente pago",
  PAGO: "Pago",
};

export const paymentStatusClasses: Record<AppointmentPaymentStatus, string> = {
  NAO_PAGO: "bg-accent-red/10 text-accent-red",
  PARCIALMENTE_PAGO: "bg-accent-yellow/10 text-accent-yellow",
  PAGO: "bg-accent-lime/10 text-accent-lime",
};

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  AGENDADO: "Agendado",
  EM_ANDAMENTO: "Em andamento",
  FINALIZADO: "Finalizado",
  CANCELADO: "Cancelado",
};
