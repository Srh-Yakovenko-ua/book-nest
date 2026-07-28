"use client";

import type { ReactNode } from "react";

import type { UiIconName } from "@/components/icons";
import type { StatCardIconTone } from "@/components/ui/stat-card";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";

import { SeriesOverviewError } from "./series-overview-error";

export type SeriesSummaryCard = {
  icon: UiIconName;
  iconTone?: StatCardIconTone;
  label: string;
  microfact?: ReactNode;
  value: number;
  valueClassName?: string;
};

type SeriesSummaryCardsProps = {
  cards: SeriesSummaryCard[];
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
};

export function SeriesSummaryCards({
  cards,
  isError,
  isLoading,
  onRetry,
}: SeriesSummaryCardsProps) {
  if (isError) {
    return <SeriesOverviewError onRetry={onRetry} />;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
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
              value={card.value.toLocaleString()}
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
