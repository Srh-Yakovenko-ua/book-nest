"use client";

import type { Nullable, ReadingQueueSummaryView } from "@app/shared";

import { useFormatter, useTranslations } from "next-intl";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";

const CAPTION_SEPARATOR = " · ";
const SUMMARY_CARD_COUNT = 4;
const CARD_CLASS = "stat-card-branch";
const VALUE_CLASS = "text-3xl break-words";

type QueueSummaryCardsProps = {
  isLoading: boolean;
  seriesWithIssuesCount: number;
  summary: Nullable<ReadingQueueSummaryView>;
};

export function QueueSummaryCards({
  isLoading,
  seriesWithIssuesCount,
  summary,
}: QueueSummaryCardsProps) {
  const t = useTranslations("readingQueue.stats");
  const tUnit = useTranslations("books.library.summary");
  const format = useFormatter();

  if (isLoading) return <QueueSummaryCardsSkeleton />;
  if (summary === null) return null;

  const { inTransit, lentToSomeone, none, wantToBuy } = summary.unavailableByOwnership;
  const unavailableCaption = [
    wantToBuy > 0 ? t("unavailable.wantToBuy", { count: wantToBuy }) : null,
    inTransit > 0 ? t("unavailable.inTransit", { count: inTransit }) : null,
    lentToSomeone > 0 ? t("unavailable.lentToSomeone", { count: lentToSomeone }) : null,
    none > 0 ? t("unavailable.none", { count: none }) : null,
  ]
    .filter((fragment) => fragment !== null)
    .join(CAPTION_SEPARATOR);

  const seriesWithoutIssuesCount = Math.max(summary.seriesInQueueCount - seriesWithIssuesCount, 0);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      <StatCard
        className={CARD_CLASS}
        icon="list"
        iconTone="primary"
        label={t("total.label")}
        microfact={t("total.caption", {
          series: summary.seriesBooksCount,
          standalone: summary.standaloneBooksCount,
        })}
        size="compact"
        unit={tUnit("unitBook", { count: summary.totalCount })}
        value={format.number(summary.totalCount)}
        valueClassName={VALUE_CLASS}
      />
      <StatCard
        className={CARD_CLASS}
        icon="check-circle"
        iconTone="success"
        label={t("availableNow.label")}
        microfact={t("availableNow.caption")}
        size="compact"
        unit={tUnit("unitBook", { count: summary.availableNowCount })}
        value={format.number(summary.availableNowCount)}
        valueClassName={VALUE_CLASS}
      />
      <StatCard
        className={CARD_CLASS}
        icon="cart"
        iconTone="ink"
        label={t("unavailable.label")}
        microfact={unavailableCaption}
        size="compact"
        unit={tUnit("unitBook", { count: summary.unavailableCount })}
        value={format.number(summary.unavailableCount)}
        valueClassName={VALUE_CLASS}
      />
      <StatCard
        className={CARD_CLASS}
        icon="layers"
        iconTone="info"
        label={t("seriesInQueue.label")}
        microfact={t("seriesInQueue.caption", {
          withIssues: seriesWithIssuesCount,
          withoutIssues: seriesWithoutIssuesCount,
        })}
        size="compact"
        unit={tUnit("unitSeries", { count: summary.seriesInQueueCount })}
        value={format.number(summary.seriesInQueueCount)}
        valueClassName={VALUE_CLASS}
      />
    </div>
  );
}

export function QueueSummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      {Array.from({ length: SUMMARY_CARD_COUNT }, (_, index) => (
        <Card
          className="flex flex-row items-center gap-2.5 border border-border bg-card px-3 py-3 shadow-card sm:gap-3 sm:px-4 sm:py-3.5"
          key={index}
        >
          <Skeleton className="size-10 shrink-0 rounded-full sm:size-11" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-6 w-12" />
            <Skeleton className="h-3 w-24" />
          </div>
        </Card>
      ))}
    </div>
  );
}
