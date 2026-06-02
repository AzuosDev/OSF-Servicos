import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-sans text-3xl font-bold tracking-tight text-text-primary">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
        )}
      </div>
      {action}
    </header>
  );
}

export function Placeholder({ message }: { message: string }) {
  return (
    <div className="rounded-card border border-dashed border-bg-overlay bg-bg-card p-10 text-center text-sm text-text-secondary">
      {message}
    </div>
  );
}
