"use client";

import type { ReactNode } from "react";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { LibrarySummaryCards } from "@/features/books/components/library-summary-cards";

import { SeriesOverviewError } from "./series-overview-error";

type SeriesSummaryCardsProps = {
  cards: LibrarySummaryCard[];
  isError: boolean;
  isLoading: boolean;
  mobileAction?: ReactNode;
  onRetry: () => void;
};

export function SeriesSummaryCards({
  cards,
  isError,
  isLoading,
  mobileAction,
  onRetry,
}: SeriesSummaryCardsProps) {
  if (isError) {
    return <SeriesOverviewError onRetry={onRetry} />;
  }

  return (
    <LibrarySummaryCards
      cards={cards}
      isLoading={isLoading}
      mobileAction={mobileAction}
      mobileLayout="compact"
    />
  );
}
