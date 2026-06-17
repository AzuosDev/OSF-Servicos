import type { ReactNode } from "react";
import { X } from "lucide-react";

export function ModalShell({
  open,
  title,
  icon,
  onClose,
  children,
  containerClassName = "",
}: {
  open: boolean;
  title: string;
  icon: ReactNode;
  onClose: () => void;
  children: ReactNode;
  containerClassName?: string;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className={`max-h-[90vh] w-full max-w-lg flex flex-col rounded-2xl border border-bg-muted bg-bg-card p-5 shadow-2xl ${containerClassName}`}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {icon}
              <h2 className="font-sans text-xl font-bold text-white">{title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-xl text-text-secondary hover:bg-bg-overlay hover:text-white"
              aria-label="Fechar modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">

        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {icon}
            <h2 className="font-sans text-xl font-bold text-white">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl text-text-secondary hover:bg-bg-overlay hover:text-white"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

