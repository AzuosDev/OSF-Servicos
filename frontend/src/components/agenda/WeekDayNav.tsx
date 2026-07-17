import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatMonthYear, formatWeekdayShort, isToday, toDateKey } from "../../lib/agenda";

export function WeekDayNav({
  days,
  selectedDate,
  onSelectDate,
  onPrev,
  onNext,
}: {
  days: Date[];
  selectedDate: string;
  onSelectDate: (dateKey: string) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const monthLabel = days.length > 0 ? formatMonthYear(days[Math.floor(days.length / 2)]) : "";

  return (
    <div className="rounded-2xl border border-bg-muted bg-bg-card p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-text-secondary transition hover:bg-bg-overlay hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Anterior</span>
        </button>
        <p className="text-sm font-semibold capitalize text-white">{monthLabel}</p>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-text-secondary transition hover:bg-bg-overlay hover:text-white"
        >
          <span className="hidden sm:inline">Próximo</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
        {days.map((day) => {
          const dateKey = toDateKey(day);
          const active = dateKey === selectedDate;
          const today = isToday(day);
          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelectDate(dateKey)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl px-1 py-2.5 transition",
                active
                  ? "bg-accent-lime text-black"
                  : "text-text-secondary hover:bg-bg-overlay hover:text-white",
              )}
            >
              <span className="text-[10px] font-semibold uppercase">{formatWeekdayShort(day)}</span>
              <span className="text-lg font-bold">{day.getUTCDate()}</span>
              {today && (
                <span className={cn("h-1 w-1 rounded-full", active ? "bg-black" : "bg-accent-lime")} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
