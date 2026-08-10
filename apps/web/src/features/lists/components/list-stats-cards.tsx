"use client";

import type { ListOverviewView, Nullable } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { LibrarySummaryCards } from "@/features/books/components/library-summary-cards";
import { formatNumber } from "@/lib/format";

type ListStatsCardsProps = {
  isPending: boolean;
  overview: Nullable<ListOverviewView>;
};

const LIST_STAT_CARD_COUNT = 4;

export function ListStatsCards({ isPending, overview }: ListStatsCardsProps) {
  const t = useTranslations("lists.details.stats");
  const locale = useLocale();

  if (isPending) {
    return <LibrarySummaryCards cards={[]} isLoading skeletonCount={LIST_STAT_CARD_COUNT} />;
  }

  if (overview === null || overview.totalBooks === 0) return null;

  const { distinctAuthorsCount, finishedCount, inQueueCount, ownedCount, totalBooks } = overview;

  function finishedCaption() {
    if (finishedCount === 0) return t("finished.captionEmpty");
    return t("finished.caption", { percent: Math.round((finishedCount / totalBooks) * 100) });
  }

  function inQueueCaption() {
    if (inQueueCount === 0) return t("inQueue.captionEmpty");
    if (inQueueCount === totalBooks) return t("inQueue.captionFull");
    return t("inQueue.caption", { count: totalBooks - inQueueCount });
  }

  function ownedCaption() {
    if (ownedCount === 0) return t("owned.captionEmpty");
    if (ownedCount === totalBooks) return t("owned.captionFull");
    return t("owned.caption", { count: totalBooks - ownedCount });
  }

  const cards: LibrarySummaryCard[] = [
    {
      icon: "library",
      iconTone: "primary",
      label: t("total.title"),
      microfact: t("total.caption", { count: distinctAuthorsCount }),
      unit: t("total.value", { count: totalBooks }),
      value: formatNumber(totalBooks, locale),
    },
    {
      icon: "check-circle",
      iconTone: "success",
      label: t("finished.title"),
      microfact: finishedCaption(),
      unit: t("finished.value", { count: finishedCount }),
      value: formatNumber(finishedCount, locale),
    },
    {
      icon: "check-square",
      iconTone: "info",
      label: t("inQueue.title"),
      microfact: inQueueCaption(),
      unit: t("inQueue.value", { count: inQueueCount }),
      value: formatNumber(inQueueCount, locale),
    },
    {
      icon: "library-big",
      iconTone: "ink",
      label: t("owned.title"),
      microfact: ownedCaption(),
      unit: t("owned.value", { count: ownedCount }),
      value: formatNumber(ownedCount, locale),
    },
  ];

  return <LibrarySummaryCards cards={cards} isLoading={false} />;
}
