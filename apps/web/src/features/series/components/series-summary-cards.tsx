"use client";

import type { ReactNode } from "react";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { SummaryError } from "@/components/summary-error";
import { LibrarySummaryCards } from "@/features/books/components/library-summary-cards";

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
  return (
    <SummaryError state={isError ? { onRetry } : null}>
      <LibrarySummaryCards
        cards={cards}
        isLoading={isLoading}
        mobileAction={mobileAction}
        mobileLayout="compact"
      />
    </SummaryError>
  );
}
