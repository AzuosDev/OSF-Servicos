import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  buildMonthGrid,
  formatMonthYear,
  formatWeekdayShort,
  isPastDay,
  isSameMonth,
  isToday,
  toDateKey,
} from "../../lib/agenda";

export function MonthCalendar({
  monthAnchor,
  selectedDate,
  onSelectDate,
  onMonthChange,
  disablePast = true,
}: {
  monthAnchor: Date;
  selectedDate: string;
  onSelectDate: (dateKey: string) => void;
  onMonthChange: (nextAnchor: Date) => void;
  // No wizard de agendamento não faz sentido escolher uma data passada; já na Agenda o
  // usuário pode querer consultar agendamentos de dias anteriores.
  disablePast?: boolean;
}) {
  const weeks = buildMonthGrid(monthAnchor);
  const weekdayLabels = weeks[0].map((day) => formatWeekdayShort(day).toUpperCase());

  const goPrevMonth = () => {
    onMonthChange(new Date(Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth() - 1, 1)));
  };
  const goNextMonth = () => {
    onMonthChange(new Date(Date.UTC(monthAnchor.getUTCFullYear(), monthAnchor.getUTCMonth() + 1, 1)));
  };

  return (
    <div className="rounded-2xl border border-bg-muted bg-bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={goPrevMonth}
          className="rounded-lg p-1.5 text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-bold capitalize text-white">{formatMonthYear(monthAnchor)}</p>
        <button
          type="button"
          onClick={goNextMonth}
          className="rounded-lg p-1.5 text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
          aria-label="Próximo mês"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-text-muted">
        {weekdayLabels.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {weeks.flat().map((day) => {
          const key = toDateKey(day);
          const outsideMonth = !isSameMonth(day, monthAnchor);
          const sunday = day.getUTCDay() === 0;
          const past = disablePast && isPastDay(day);
          const disabled = outsideMonth || sunday || past;
          const selected = key === selectedDate;
          const today = isToday(day);

          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onSelectDate(key)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-sm transition",
                disabled && "cursor-not-allowed text-text-muted opacity-40",
                !disabled && !selected && "text-white hover:bg-bg-overlay",
                !disabled && today && !selected && "font-semibold text-accent-gold ring-1 ring-inset ring-accent-gold",
                selected && "bg-accent-gold font-bold text-black",
              )}
            >
              {day.getUTCDate()}
              {today && !selected && <span className="h-1 w-1 rounded-full bg-accent-gold" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
