"use client";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { SummaryError } from "@/components/summary-error";
import { LibrarySummaryCards } from "@/features/books/components/library-summary-cards";

export type TagsSummaryStatus = "error" | "pending" | "success";

type TagsSummaryCardsProps = {
  cards: LibrarySummaryCard[];
  onRetry: () => void;
  status: TagsSummaryStatus;
};

const TAGS_SUMMARY = {
  cardsCount: 4,
} as const;

export function TagsSummaryCards({ cards, onRetry, status }: TagsSummaryCardsProps) {
  return (
    <SummaryError className="max-sm:hidden" state={status === "error" ? { onRetry } : null}>
      <LibrarySummaryCards
        cards={cards}
        isLoading={status === "pending"}
        skeletonCount={TAGS_SUMMARY.cardsCount}
      />
    </SummaryError>
  );
}
