"use client";

import type { Nullable, ReadingQueueSummaryView } from "@app/shared";

import { useFormatter, useTranslations } from "next-intl";

import type { LibrarySummaryCard } from "../components/library-summary-cards";

const CAPTION_SEPARATOR = " · ";

export const QUEUE_SUMMARY_CARD_COUNT = 4;

export function useQueueSummaryCards({
  seriesWithIssuesCount,
  summary,
}: {
  seriesWithIssuesCount: number;
  summary: Nullable<ReadingQueueSummaryView>;
}): LibrarySummaryCard[] {
  const t = useTranslations("readingQueue.stats");
  const tMobile = useTranslations("readingQueue.stats.mobile");
  const tUnit = useTranslations("books.library.summary");
  const format = useFormatter();

  if (summary === null) return [];

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

  const mobileLabels = (key: "availableNow" | "seriesInQueue" | "total" | "unavailable") => ({
    compact: tMobile(`compact.${key}`),
    detailed: tMobile(`detailed.${key}`),
  });

  return [
    {
      icon: "list",
      iconTone: "primary",
      label: t("total.label"),
      microfact: t("total.caption", {
        series: summary.seriesBooksCount,
        standalone: summary.standaloneBooksCount,
      }),
      mobileLabels: mobileLabels("total"),
      unit: tUnit("unitBook", { count: summary.totalCount }),
      value: format.number(summary.totalCount),
    },
    {
      icon: "check-circle",
      iconTone: "success",
      label: t("availableNow.label"),
      microfact: t("availableNow.caption"),
      mobileLabels: mobileLabels("availableNow"),
      unit: tUnit("unitBook", { count: summary.availableNowCount }),
      value: format.number(summary.availableNowCount),
    },
    {
      icon: "cart",
      iconTone: "ink",
      label: t("unavailable.label"),
      microfact: unavailableCaption,
      mobileLabels: mobileLabels("unavailable"),
      unit: tUnit("unitBook", { count: summary.unavailableCount }),
      value: format.number(summary.unavailableCount),
    },
    {
      icon: "layers",
      iconTone: "info",
      label: t("seriesInQueue.label"),
      microfact: t("seriesInQueue.caption", {
        withIssues: seriesWithIssuesCount,
        withoutIssues: seriesWithoutIssuesCount,
      }),
      mobileLabels: mobileLabels("seriesInQueue"),
      unit: tUnit("unitSeries", { count: summary.seriesInQueueCount }),
      value: format.number(summary.seriesInQueueCount),
    },
  ];
}
