import type { ReactNode } from "react";

export function StatisticsStat({
  hint,
  label,
  value,
}: {
  hint?: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-border bg-secondary/50 px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-heading text-base font-semibold text-ink tabular-nums">{value}</dd>
      {hint === undefined ? null : (
        <dd className="text-[0.6875rem] text-muted-foreground">{hint}</dd>
      )}
    </div>
  );
}
