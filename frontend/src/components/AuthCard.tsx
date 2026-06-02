import { Coins } from "lucide-react";
import type { ReactNode } from "react";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base px-4">
      <div className="mx-auto mt-20 w-full max-w-sm rounded-card bg-bg-card p-8 shadow-xl ring-1 ring-bg-overlay">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-icon bg-accent-lime/10">
              <Coins className="h-5 w-5 text-accent-lime" />
            </span>
            <span className="font-sans text-xl font-bold tracking-tight">
              ContaCerta
            </span>
          </div>
          <h1 className="font-sans text-2xl font-bold text-text-primary">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
          )}
        </div>

        {children}

        {footer && (
          <div className="mt-6 text-center text-sm text-text-secondary">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
