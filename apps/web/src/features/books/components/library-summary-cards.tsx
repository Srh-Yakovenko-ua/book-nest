import type { ReactNode } from "react";

import type { UiIconName } from "@/components/icons";
import type { StatCardIconTone } from "@/components/ui/stat-card";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";

export type LibrarySummaryCard = {
  icon: UiIconName;
  iconSlot?: ReactNode;
  iconTone?: StatCardIconTone;
  label: string;
  microfact?: ReactNode;
  unit?: ReactNode;
  value: number | string;
  valueClassName?: string;
};

type LibrarySummaryCardsProps = {
  cards: LibrarySummaryCard[];
  isLoading: boolean;
};

export function LibrarySummaryCards({ cards, isLoading }: LibrarySummaryCardsProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:gap-4", summaryGridColumns(cards.length))}>
      {isLoading
        ? Array.from({ length: cards.length }, (_, index) => <SummaryCardSkeleton key={index} />)
        : cards.map((card) => (
            <StatCard
              className="stat-card-branch"
              icon={card.icon}
              iconSlot={card.iconSlot}
              iconTone={card.iconTone}
              key={card.label}
              label={card.label}
              microfact={card.microfact}
              size="compact"
              unit={card.unit}
              value={typeof card.value === "number" ? card.value.toLocaleString() : card.value}
              valueClassName={cn("text-3xl break-words", card.valueClassName)}
            />
          ))}
    </div>
  );
}

function SummaryCardSkeleton() {
  return (
    <Card className="flex flex-row items-center gap-2.5 border border-border bg-card px-3 py-3 shadow-card sm:gap-3 sm:px-4 sm:py-3.5">
      <Skeleton className="size-10 shrink-0 rounded-full sm:size-11" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-6 w-12" />
        <Skeleton className="h-3 w-24" />
      </div>
    </Card>
  );
}

function summaryGridColumns(count: number): string {
  if (count === 6) return "xl:grid-cols-3";
  return "xl:grid-cols-4";
}
