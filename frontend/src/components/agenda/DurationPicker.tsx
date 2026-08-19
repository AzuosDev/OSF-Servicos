import { cn } from "../../lib/utils";

const QUICK_OPTIONS = [
  { label: "30 min", minutes: 30 },
  { label: "1 hora", minutes: 60 },
  { label: "1h30", minutes: 90 },
  { label: "2 horas", minutes: 120 },
  { label: "3 horas", minutes: 180 },
];

export function DurationPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (minutes: number) => void;
}) {
  return (
    <div className="space-y-2">
      <span className="block text-sm text-text-secondary">Duração estimada</span>
      <div className="flex flex-wrap gap-2">
        {QUICK_OPTIONS.map((opt) => (
          <button
            key={opt.minutes}
            type="button"
            onClick={() => onChange(opt.minutes)}
            className={cn(
              "rounded-xl px-3 py-2 text-xs font-semibold transition",
              value === opt.minutes
                ? "bg-accent-gold text-black"
                : "bg-bg-muted text-text-secondary hover:bg-bg-overlay hover:text-text-primary",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2">
        <span className="text-xs text-text-secondary">Ou informe em minutos:</span>
        <input
          type="number"
          min={5}
          step={5}
          value={value}
          onChange={(e) => {
            const parsed = Number(e.target.value);
            onChange(Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
          }}
          className="w-24 rounded-xl border border-bg-muted bg-bg-muted px-3 py-2 text-sm text-white outline-none focus:border-accent-gold"
        />
      </label>
    </div>
  );
}
