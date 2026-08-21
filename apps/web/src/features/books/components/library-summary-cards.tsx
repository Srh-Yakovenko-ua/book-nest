import type { ReactNode } from "react";

import type { UiIconName } from "@/components/icons";
import type { StatCardIconTone } from "@/components/ui/stat-card";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { cn } from "@/lib/utils";

import { LibrarySummaryMobile } from "./library-summary-mobile";

export type LibrarySummaryCard = {
  caption?: ReactNode;
  icon: UiIconName;
  iconSlot?: ReactNode;
  iconTone?: StatCardIconTone;
  label: string;
  microfact?: ReactNode;
  mobileLabels?: { compact: string; detailed: string };
  unit?: ReactNode;
  value: number | string;
  valueClassName?: string;
};

type LibrarySummaryCardsProps = {
  cards: LibrarySummaryCard[];
  isLoading: boolean;
  mobileAction?: ReactNode;
  mobileCards?: LibrarySummaryCard[];
  mobileLayout?: "compact" | "grid";
  skeletonCount?: number;
};

export function LibrarySummaryCards({
  cards,
  isLoading,
  mobileAction,
  mobileCards,
  mobileLayout = "grid",
  skeletonCount,
}: LibrarySummaryCardsProps) {
  const compactOnMobile = mobileLayout === "compact";

  return (
    <>
      {compactOnMobile ? (
        <LibrarySummaryMobile
          action={mobileAction}
          cards={mobileCards ?? cards}
          className="sm:hidden"
          isLoading={isLoading}
          skeletonCount={skeletonCount}
        />
      ) : null}
      <SummaryGrid
        cards={cards}
        className={compactOnMobile ? "max-sm:hidden" : undefined}
        isLoading={isLoading}
        skeletonCount={skeletonCount}
      />
    </>
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

function SummaryGrid({
  cards,
  className,
  isLoading,
  skeletonCount,
}: LibrarySummaryCardsProps & { className?: string }) {
  const columnCount = skeletonCount ?? cards.length;

  return (
    <div
      className={cn("grid grid-cols-2 gap-3 sm:gap-4", summaryGridColumns(columnCount), className)}
    >
      {isLoading
        ? Array.from({ length: columnCount }, (_, index) => <SummaryCardSkeleton key={index} />)
        : cards.map((card) => (
            <StatCard
              caption={card.caption}
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

function summaryGridColumns(count: number): string {
  if (count === 5 || count === 6) return "xl:grid-cols-3";
  return "xl:grid-cols-4";
}
