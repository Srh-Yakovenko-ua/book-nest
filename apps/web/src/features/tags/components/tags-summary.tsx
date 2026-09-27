"use client";

import { useTranslations } from "next-intl";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
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
    <div className="max-sm:hidden" role={status === "error" ? "alert" : undefined}>
      {status === "error" ? (
        <TagsSummaryError onRetry={onRetry} />
      ) : (
        <LibrarySummaryCards
          cards={cards}
          isLoading={status === "pending"}
          skeletonCount={TAGS_SUMMARY.cardsCount}
        />
      )}
    </div>
  );
}

export function TagsSummaryError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("tags.summary.error");

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <UiIcon aria-hidden className="shrink-0 text-error" name="alert-circle" size={16} />
        {t("title")}
      </p>
      <Button className="self-start sm:self-auto" onClick={onRetry} size="sm" variant="secondary">
        <UiIcon aria-hidden name="refresh" size={16} />
        {t("retry")}
      </Button>
    </div>
  );
}
