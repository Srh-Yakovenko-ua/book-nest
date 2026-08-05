"use client";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";

type DedicationsSummaryCardsProps = {
  cards: LibrarySummaryCard[];
  isLoading: boolean;
};

export function DedicationsSummaryCards({ cards, isLoading }: DedicationsSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
      {isLoading
        ? Array.from({ length: cards.length }, (_, index) => <SummaryCardSkeleton key={index} />)
        : cards.map((card) => (
            <StatCard
              className="stat-card-branch"
              icon={card.icon}
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
