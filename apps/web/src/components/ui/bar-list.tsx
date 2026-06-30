"use client";

import * as React from "react";

import { UiIcon } from "@/components/icons/ui-icon";
import { cn } from "@/lib/utils";

type BarListItem = {
  formattedValue?: React.ReactNode;
  label: string;
  value: number;
};

type BarListProps = Omit<React.ComponentProps<"div">, "children"> & {
  base?: "max" | "sum";
  compact?: boolean;
  emphasizeLeader?: boolean;
  emptyLabel?: React.ReactNode;
  items: readonly BarListItem[];
};

function BarList({
  className,
  items,
  base = "max",
  emphasizeLeader = false,
  compact = false,
  emptyLabel,
  ...props
}: BarListProps) {
  if (items.length === 0) {
    return (
      <div
        className="flex flex-col items-center gap-2 py-[18px] text-center text-muted-foreground"
        data-slot="bar-list"
      >
        <UiIcon className="text-accent-border" name="chart" size={34} />
        <span className="text-[0.9375rem] text-foreground">{emptyLabel ?? "No data yet"}</span>
      </div>
    );
  }

  const sorted = [...items].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, item) => sum + item.value, 0);
  const peak = sorted[0]?.value ?? 0;
  const reference = base === "sum" ? total : peak;

  return (
    <div
      className={cn("flex flex-col", compact ? "gap-[11px]" : "gap-4", className)}
      data-slot="bar-list"
      {...props}
    >
      {sorted.map((item, index) => {
        const width = reference <= 0 ? 0 : (item.value / reference) * 100;
        const isLeader = emphasizeLeader && index === 0;

        return (
          <div
            className={cn("flex flex-col", compact ? "gap-[5px]" : "gap-[7px]")}
            key={item.label}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span
                className={cn(
                  "truncate font-medium text-foreground",
                  compact ? "text-sm" : "text-[0.9375rem]",
                )}
              >
                {item.label}
              </span>
              <span
                className={cn(
                  "shrink-0 text-sm font-bold tabular-nums",
                  isLeader ? "text-primary" : "text-ink",
                )}
              >
                {item.formattedValue ?? item.value}
              </span>
            </div>
            <div
              aria-label={`${item.label}: ${item.formattedValue ?? item.value}`}
              className={cn(
                "w-full overflow-hidden rounded-full bg-secondary",
                compact ? "h-[5px]" : "h-1.5",
              )}
              role="img"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none",
                  emphasizeLeader && !isLeader ? "bg-primary/40" : "bg-primary",
                )}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { BarList };
export type { BarListItem };
