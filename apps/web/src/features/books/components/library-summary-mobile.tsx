"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { statCardIconBadge } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";

import type { LibrarySummaryCard } from "./library-summary-cards";

type LibrarySummaryMobileProps = {
  cards: LibrarySummaryCard[];
  className?: string;
  isLoading: boolean;
};

const BADGE_SIZE = {
  detail: "size-7 [&_svg]:size-4",
  tile: "size-6 [&_svg]:size-3.5",
} as const;

const TILE_CLASS = "items-center gap-1 px-1.5 py-2.5 shadow-card";

export function LibrarySummaryMobile({ cards, className, isLoading }: LibrarySummaryMobileProps) {
  const t = useTranslations("books.library.summary.mobile");
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (isLoading) {
    return (
      <div className={cn("grid grid-cols-4 gap-2", className)}>
        {Array.from({ length: cards.length }, (_, index) => (
          <Card className={cn(TILE_CLASS, "gap-1.5")} key={index}>
            <span className="flex items-center gap-1.5">
              <Skeleton className="size-6 rounded-full" />
              <Skeleton className="h-4 w-5" />
            </span>
            <Skeleton className="h-2.5 w-12" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Collapsible
      className={cn("flex flex-col gap-2.5", className)}
      onOpenChange={setDetailsOpen}
      open={detailsOpen}
    >
      <div className="grid grid-cols-4 gap-2">
        {cards.map((card) => (
          <Card className={TILE_CLASS} key={card.label}>
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

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <h2>
          <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2 px-3.5 py-3 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">
            <UiIcon aria-hidden className="shrink-0 text-primary" name="chart" size={16} />
            <span className="flex-1 font-heading text-sm font-semibold text-ink">{t("title")}</span>
            <UiIcon
              aria-hidden
              className={cn(
                "shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-200",
                detailsOpen && "rotate-180",
              )}
              name="chevron-down"
              size={16}
            />
          </CollapsibleTrigger>
        </h2>

        <CollapsibleContent className="overflow-hidden duration-300 ease-out data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none">
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
                  <span className="truncate text-xs font-medium text-muted-foreground">
                    {card.mobileLabels?.detailed ?? card.label}
                  </span>
                </dt>
                <dd className="flex min-w-0 flex-col gap-1 pl-9">
                  <span className="flex items-baseline gap-1 whitespace-nowrap">
                    <span className="font-heading text-lg leading-tight font-bold text-ink tabular-nums">
                      {formatValue(card.value)}
                    </span>
                    {card.unit === undefined ? null : (
                      <span className="text-xs font-medium text-muted-foreground">{card.unit}</span>
                    )}
                  </span>
                  {card.microfact === undefined ? null : (
                    <div className="text-xs text-muted-foreground">{card.microfact}</div>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

function formatValue(value: LibrarySummaryCard["value"]) {
  return typeof value === "number" ? value.toLocaleString() : value;
}

function SummaryBadge({ card, size }: { card: LibrarySummaryCard; size: keyof typeof BADGE_SIZE }) {
  return (
    <span className={cn(statCardIconBadge({ tone: card.iconTone }), BADGE_SIZE[size])}>
      {card.iconSlot ?? <UiIcon aria-hidden name={card.icon} />}
    </span>
  );
}
