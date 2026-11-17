"use client";

import type { ReactNode } from "react";

import type { SummaryCard } from "@/components/catalog/summary-cards";

import { SummaryCards } from "@/components/catalog/summary-cards";
import { SummaryError } from "@/components/summary-error";

type SeriesSummaryCardsProps = {
  cards: SummaryCard[];
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
      <SummaryCards
        cards={cards}
        isLoading={isLoading}
        mobileAction={mobileAction}
        mobileLayout="compact"
      />
    </SummaryError>
  );
}
