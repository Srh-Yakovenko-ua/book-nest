"use client";

import type { ReactNode } from "react";

import type { SummaryCard } from "@/components/catalog/summary-cards";

import { SummaryCards } from "@/components/catalog/summary-cards";

export const DELIVERY_MOBILE_TILE_COUNT = 4;

type DeliverySummaryCardsProps = {
  cards: SummaryCard[];
  isLoading: boolean;
  mobileAction?: ReactNode;
};

export function DeliverySummaryCards({
  cards,
  isLoading,
  mobileAction,
}: DeliverySummaryCardsProps) {
  return (
    <SummaryCards
      cards={cards}
      isLoading={isLoading}
      mobileAction={mobileAction}
      mobileCards={cards.slice(0, DELIVERY_MOBILE_TILE_COUNT)}
      mobileLayout="compact"
    />
  );
}
