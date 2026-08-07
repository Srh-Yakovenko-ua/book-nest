"use client";

import type { ListsSummaryView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { LibrarySummaryCards } from "@/features/books/components/library-summary-cards";

type ListsSummaryCardsProps = {
  cards: LibrarySummaryCard[];
  isError: boolean;
  isLoading: boolean;
  mobileAction?: ReactNode;
};

const EMPTY_SUMMARY: ListsSummaryView = {
  averageBooksPerList: 0,
  emptyListCount: 0,
  largestListBookCount: 0,
  listsWithBooksCount: 0,
  maxListsPerBook: 0,
  multiListBookCount: 0,
  noDescriptionListCount: 0,
  staleListCount: 0,
  totalListCount: 0,
  totalMembershipCount: 0,
  uniqueBookCount: 0,
};

export function ListsSummaryCards({
  cards,
  isError,
  isLoading,
  mobileAction,
}: ListsSummaryCardsProps) {
  if (isError) return null;

  return (
    <LibrarySummaryCards
      cards={cards}
      isLoading={isLoading}
      mobileAction={mobileAction}
      mobileLayout="compact"
    />
  );
}

export function useListsSummaryCards(summary?: ListsSummaryView): LibrarySummaryCard[] {
  const t = useTranslations("lists.catalog.summary");
  const stats = summary ?? EMPTY_SUMMARY;

  const mobileLabels = (key: "averageSize" | "multiList" | "totalLists" | "uniqueBooks") => ({
    compact: t(`mobile.compact.${key}`),
    detailed: t(`mobile.detailed.${key}`),
  });

  return [
    {
      icon: "list",
      iconTone: "primary",
      label: t("totalLists"),
      microfact:
        stats.emptyListCount === 0
          ? t("listsAllFilled")
          : t("listsBreakdown", {
              empty: stats.emptyListCount,
              withBooks: stats.listsWithBooksCount,
            }),
      mobileLabels: mobileLabels("totalLists"),
      unit: t("listsUnit", { count: stats.totalListCount }),
      value: stats.totalListCount,
    },
    {
      icon: "library-big",
      iconTone: "info",
      label: t("uniqueBooks"),
      microfact: t("memberships", { count: stats.totalMembershipCount }),
      mobileLabels: mobileLabels("uniqueBooks"),
      unit: t("booksUnit", { count: stats.uniqueBookCount }),
      value: stats.uniqueBookCount,
    },
    {
      icon: "chart-increasing",
      iconTone: "success",
      label: t("averageSize"),
      microfact: t("largestList", { count: stats.largestListBookCount }),
      mobileLabels: mobileLabels("averageSize"),
      unit: t("booksUnit", { count: stats.averageBooksPerList }),
      value: stats.averageBooksPerList,
    },
    {
      icon: "layers",
      iconTone: "genre",
      label: t("multiList"),
      microfact:
        stats.multiListBookCount === 0
          ? t("singleListOnly")
          : t("maxReach", { count: stats.maxListsPerBook }),
      mobileLabels: mobileLabels("multiList"),
      unit: t("booksUnit", { count: stats.multiListBookCount }),
      value: stats.multiListBookCount,
    },
  ];
}
