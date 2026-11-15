"use client";

import type { Nullable, ReadingQueueSummaryView } from "@app/shared";
import type { ReactNode } from "react";

import { SummaryCards } from "@/components/catalog/summary-cards";

import { QUEUE_SUMMARY_CARD_COUNT, useQueueSummaryCards } from "../hooks/use-queue-summary-cards";

type QueueSummaryCardsProps = {
  isLoading: boolean;
  mobileAction?: ReactNode;
  seriesWithIssuesCount: number;
  summary: Nullable<ReadingQueueSummaryView>;
};

export function QueueSummaryCards({
  isLoading,
  mobileAction,
  seriesWithIssuesCount,
  summary,
}: QueueSummaryCardsProps) {
  const cards = useQueueSummaryCards({ seriesWithIssuesCount, summary });

  if (isLoading) return <QueueSummaryCardsSkeleton />;
  if (summary === null) return null;

  return (
    <SummaryCards
      cards={cards}
      isLoading={false}
      mobileAction={mobileAction}
      mobileLayout="compact"
    />
  );
}

export function QueueSummaryCardsSkeleton() {
  return (
    <SummaryCards
      cards={[]}
      isLoading
      mobileLayout="compact"
      skeletonCount={QUEUE_SUMMARY_CARD_COUNT}
    />
  );
}
