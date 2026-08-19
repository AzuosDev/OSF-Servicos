import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatMonthYear, formatWeekdayShort, isToday, toDateKey } from "../../lib/agenda";
import { MonthCalendar } from "./MonthCalendar";

export function WeekDayNav({
  days,
  selectedDate,
  onSelectDate,
  onPrev,
  onNext,
  onJumpToDate,
}: {
  days: Date[];
  selectedDate: string;
  onSelectDate: (dateKey: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onJumpToDate: (dateKey: string) => void;
}) {
  const anchorDay = days[Math.floor(days.length / 2)] ?? new Date();
  const monthLabel = days.length > 0 ? formatMonthYear(anchorDay) : "";

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(anchorDay);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!calendarOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setCalendarOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [calendarOpen]);

  const toggleCalendar = () => {
    setCalendarOpen((open) => {
      if (!open) setCalendarMonth(anchorDay);
      return !open;
    });
  };

  const handlePickDate = (dateKey: string) => {
    onJumpToDate(dateKey);
    setCalendarOpen(false);
  };

  return (
    <div className="rounded-2xl border border-bg-muted bg-bg-card p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Anterior</span>
        </button>

        <div className="relative">
          <button
            ref={buttonRef}
            type="button"
            onClick={toggleCalendar}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold capitalize text-white transition hover:bg-bg-overlay"
          >
            <CalendarDays className="h-3.5 w-3.5 text-text-secondary" />
            {monthLabel}
          </button>

          {calendarOpen && (
            <div
              ref={panelRef}
              className="absolute left-1/2 top-full z-20 mt-2 w-72 -translate-x-1/2"
            >
              <MonthCalendar
                monthAnchor={calendarMonth}
                selectedDate={selectedDate}
                onSelectDate={handlePickDate}
                onMonthChange={setCalendarMonth}
                disablePast={false}
              />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
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
                  ? "bg-accent-gold text-black"
                  : "text-text-secondary hover:bg-bg-overlay hover:text-text-primary",
              )}
            >
              <span className="text-[10px] font-semibold uppercase">{formatWeekdayShort(day)}</span>
              <span className="text-lg font-bold">{day.getUTCDate()}</span>
              {today && (
                <span className={cn("h-1 w-1 rounded-full", active ? "bg-black" : "bg-accent-gold")} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
