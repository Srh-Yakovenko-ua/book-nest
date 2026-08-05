"use client";

import type { ListsSummaryView } from "@app/shared";

import { useTranslations } from "next-intl";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { LibrarySummaryCards } from "@/features/books/components/library-summary-cards";

type ListsSummaryCardsProps = {
  isError: boolean;
  isLoading: boolean;
  summary?: ListsSummaryView;
};

const EMPTY_SUMMARY: ListsSummaryView = {
  averageBooksPerList: 0,
  emptyListCount: 0,
  largestListBookCount: 0,
  listsWithBooksCount: 0,
  maxListsPerBook: 0,
  multiListBookCount: 0,
  totalListCount: 0,
  totalMembershipCount: 0,
  uniqueBookCount: 0,
};

export function ListsSummaryCards({ isError, isLoading, summary }: ListsSummaryCardsProps) {
  const t = useTranslations("lists.catalog.summary");
  const stats = summary ?? EMPTY_SUMMARY;

  if (isError) return null;

  const cards: LibrarySummaryCard[] = [
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
      unit: t("listsUnit", { count: stats.totalListCount }),
      value: stats.totalListCount,
    },
    {
      icon: "library-big",
      iconTone: "info",
      label: t("uniqueBooks"),
      microfact: t("memberships", { count: stats.totalMembershipCount }),
      unit: t("booksUnit", { count: stats.uniqueBookCount }),
      value: stats.uniqueBookCount,
    },
    {
      icon: "chart-increasing",
      iconTone: "success",
      label: t("averageSize"),
      microfact: t("largestList", { count: stats.largestListBookCount }),
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
      unit: t("booksUnit", { count: stats.multiListBookCount }),
      value: stats.multiListBookCount,
    },
  ];

  return <LibrarySummaryCards cards={cards} isLoading={isLoading} />;
}
