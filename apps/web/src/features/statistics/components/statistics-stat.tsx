import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type StatisticsStatSize = "default" | "lg";

const STAT_VALUE_SIZE = {
  default: "text-base",
  lg: "text-lg leading-tight",
} as const satisfies Record<StatisticsStatSize, string>;

export function StatisticsStat({
  hint,
  label,
  size = "default",
  value,
}: {
  hint?: string;
  label: string;
  size?: StatisticsStatSize;
  value: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-border bg-secondary/50 px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("font-heading font-semibold text-ink tabular-nums", STAT_VALUE_SIZE[size])}>
        {value}
      </dd>
      {hint === undefined ? null : (
        <dd className="text-[0.6875rem] text-muted-foreground">{hint}</dd>
      )}
    </div>
  );
}
