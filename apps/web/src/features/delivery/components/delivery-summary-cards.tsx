"use client";

import type { ReactNode } from "react";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { LibrarySummaryCards } from "@/features/books/components/library-summary-cards";

export const DELIVERY_MOBILE_TILE_COUNT = 4;

type DeliverySummaryCardsProps = {
  cards: LibrarySummaryCard[];
  isLoading: boolean;
  mobileAction?: ReactNode;
};

export function DeliverySummaryCards({
  cards,
  isLoading,
  mobileAction,
}: DeliverySummaryCardsProps) {
  return (
    <LibrarySummaryCards
      cards={cards}
      isLoading={isLoading}
      mobileAction={mobileAction}
      mobileCards={cards.slice(0, DELIVERY_MOBILE_TILE_COUNT)}
      mobileLayout="compact"
    />
  );
}
