"use client";

import type { ReactNode } from "react";

import { UiIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { statCardIconBadge } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";

import type { LibrarySummaryCard } from "./library-summary-cards";

type LibrarySummaryMobileProps = {
  action?: ReactNode;
  cards: LibrarySummaryCard[];
  className?: string;
  isLoading: boolean;
  skeletonCount?: number;
};

const TILE = {
  badgeSize: {
    detail: "size-7 [&_svg]:size-4",
    tile: "size-6 [&_svg]:size-3.5",
  },
  class: "items-center gap-1 px-1.5 py-2.5 shadow-card",
  columns: {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
  } as Record<number, string>,
  fallbackColumns: "grid-cols-4",
} as const;

export function LibrarySummaryDetails({
  cards,
  title,
}: {
  cards: LibrarySummaryCard[];
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <h2 className="flex items-center gap-2 px-3.5 py-3">
        <UiIcon aria-hidden className="shrink-0 text-primary" name="chart" size={16} />
        <span className="font-heading text-sm font-semibold text-ink">{title}</span>
      </h2>

      <dl className="grid grid-cols-2 border-t border-border">
        {cards.map((card, index) => (
          <div
            className={cn(
              "flex min-w-0 flex-col gap-1 p-3.5",
              index % 2 === 1 && "border-l border-border",
              index >= 2 && "border-t border-border",
            )}
            key={card.label}
          >
            <dt className="flex min-w-0 items-center gap-2">
              <SummaryBadge card={card} size="detail" />
              <span className="line-clamp-2 min-w-0 text-xs font-medium break-words text-muted-foreground">
                {card.mobileLabels?.detailed ?? card.label}
              </span>
            </dt>
            <dd className="flex min-w-0 flex-col gap-1 pl-9">
              <span className="flex min-w-0 items-baseline gap-1">
                <span className="line-clamp-2 min-w-0 font-heading text-lg leading-tight font-bold break-words text-ink tabular-nums">
                  {formatValue(card.value)}
                </span>
                {card.unit === undefined ? null : (
                  <span className="shrink-0 text-xs font-medium whitespace-nowrap text-muted-foreground">
                    {card.unit}
                  </span>
                )}
              </span>
              {card.microfact === undefined ? null : (
                <div className="text-xs text-muted-foreground">{card.microfact}</div>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function LibrarySummaryMobile({
  action,
  cards,
  className,
  isLoading,
  skeletonCount,
}: LibrarySummaryMobileProps) {
  const columnCount = skeletonCount ?? cards.length;

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div className={cn("grid gap-2", TILE.columns[columnCount] ?? TILE.fallbackColumns)}>
        {isLoading
          ? Array.from({ length: columnCount }, (_, index) => (
              <Card className={cn(TILE.class, "gap-1.5")} key={index}>
                <span className="flex items-center gap-1.5">
                  <Skeleton className="size-6 rounded-full" />
                  <Skeleton className="h-4 w-5" />
                </span>
                <Skeleton className="h-2.5 w-12" />
              </Card>
            ))
          : cards.map((card) => (
              <Card className={TILE.class} key={card.label}>
                <span className="flex max-w-full items-center gap-1.5">
                  <SummaryBadge card={card} size="tile" />
                  <span className="truncate font-heading text-lg leading-none font-bold text-ink tabular-nums">
                    {formatValue(card.value)}
                  </span>
                </span>
                <span className="w-full truncate text-center text-[0.625rem] leading-tight text-muted-foreground">
                  {card.mobileLabels?.compact ?? card.label}
                </span>
              </Card>
            ))}
      </div>

      {action}
    </div>
  );
}

function formatValue(value: LibrarySummaryCard["value"]) {
  return typeof value === "number" ? value.toLocaleString() : value;
}

function SummaryBadge({
  card,
  size,
}: {
  card: LibrarySummaryCard;
  size: keyof typeof TILE.badgeSize;
}) {
  return (
    <span className={cn(statCardIconBadge({ tone: card.iconTone }), TILE.badgeSize[size])}>
      {card.iconSlot ?? <UiIcon aria-hidden name={card.icon} />}
    </span>
  );
}
