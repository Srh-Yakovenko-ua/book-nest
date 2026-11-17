"use client";

import type { SummaryCard } from "@/components/catalog/summary-cards";

import { SummaryCards } from "@/components/catalog/summary-cards";
import { SummaryError } from "@/components/summary-error";

export type TagsSummaryStatus = "error" | "pending" | "success";

type TagsSummaryCardsProps = {
  cards: SummaryCard[];
  onRetry: () => void;
  status: TagsSummaryStatus;
};

const TAGS_SUMMARY = {
  cardsCount: 4,
} as const;

export function TagsSummaryCards({ cards, onRetry, status }: TagsSummaryCardsProps) {
  return (
    <SummaryError className="max-sm:hidden" state={status === "error" ? { onRetry } : null}>
      <SummaryCards
        cards={cards}
        isLoading={status === "pending"}
        skeletonCount={TAGS_SUMMARY.cardsCount}
      />
    </SummaryError>
  );
}
