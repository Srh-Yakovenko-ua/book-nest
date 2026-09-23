"use client";

import type { LibraryPublishersSummary } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { LibrarySummaryCards } from "@/features/books/components/library-summary-cards";
import { formatNumber } from "@/lib/format";

import { formatCoveragePercent } from "../model/publisher-format";

const SUMMARY_CARDS = {
  count: 4,
  nameValueClassName: "line-clamp-2 text-xl leading-tight",
  topCoverageThreshold: 5,
} as const;

type PublisherSummaryCardsProps = {
  cards: LibrarySummaryCard[];
  isError: boolean;
  isLoading: boolean;
  mobileAction?: ReactNode;
  onRetry: () => void;
};

type SummaryMobileKey = "inPlans" | "mostRead" | "mostRepresented" | "publishers";

export function PublisherSummaryCards({
  cards,
  isError,
  isLoading,
  mobileAction,
  onRetry,
}: PublisherSummaryCardsProps) {
  const t = useTranslations("publishers.summary");

  if (isError) {
    return (
      <div
        className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-card"
        role="alert"
      >
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-ink">{t("error.title")}</p>
          <p className="text-xs text-muted-foreground">{t("error.description")}</p>
        </div>
        <Button onClick={onRetry} size="sm" variant="secondary">
          <UiIcon name="refresh" size={16} />
          {t("error.retry")}
        </Button>
      </div>
    );
  }

  return (
    <LibrarySummaryCards
      cards={cards}
      isLoading={isLoading}
      mobileAction={mobileAction}
      mobileLayout="compact"
      skeletonCount={SUMMARY_CARDS.count}
    />
  );
}

export function usePublisherSummaryCards(
  summary: LibraryPublishersSummary | undefined,
): LibrarySummaryCard[] {
  const t = useTranslations("publishers.summary");
  const locale = useLocale();

  const mobileLabels = (key: SummaryMobileKey) => ({
    compact: t(`mobile.compact.${key}`),
    detailed: t(`mobile.detailed.${key}`),
  });

  if (summary === undefined) return [];

  const mostRead = summary.mostReadPublisher;
  const mostRepresented = summary.mostRepresentedPublisher;

  const coverageMicrofact = (): string => {
    const count = summary.publishersCount;
    if (count === 0) return t("coverage.none");
    if (count === 1) return t("coverage.single");
    if (count <= SUMMARY_CARDS.topCoverageThreshold) return t("coverage.all", { count });
    return t("coverage.top", {
      percentage: formatCoveragePercent(summary.topFiveBooksCoveragePercent, locale),
    });
  };

  return [
    {
      icon: "building",
      iconTone: "primary",
      label: t("publishers"),
      microfact: coverageMicrofact(),
      mobileLabels: mobileLabels("publishers"),
      value: formatNumber(summary.publishersCount, locale),
    },
    {
      icon: "crown",
      iconTone: "genre",
      label: t("mostRepresented"),
      microfact:
        mostRepresented === null
          ? t("coverage.none")
          : t("mostRepresentedBooks", { count: mostRepresented.booksCount }),
      mobileLabels: mobileLabels("mostRepresented"),
      value: mostRepresented?.name ?? t("noValue"),
      valueClassName: SUMMARY_CARDS.nameValueClassName,
      valueKind: "name",
    },
    {
      icon: "shopping-bag",
      iconTone: "success",
      label: t("inPlans"),
      microfact:
        summary.publishersInPlansCount === 0
          ? t("inPlansEmpty")
          : t("inPlansBooks", { count: summary.booksToBuyWithPublisherCount }),
      mobileLabels: mobileLabels("inPlans"),
      value: formatNumber(summary.publishersInPlansCount, locale),
    },
    {
      icon: "book-open-text",
      iconTone: "info",
      label: t("mostRead"),
      microfact:
        mostRead === null ? t("mostReadEmpty") : t("mostReadBooks", { count: mostRead.readCount }),
      mobileLabels: mobileLabels("mostRead"),
      value: mostRead?.name ?? t("noValue"),
      valueClassName: SUMMARY_CARDS.nameValueClassName,
      valueKind: "name",
    },
  ];
}
