"use client";

import type { LibraryPublishersSummary } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { LibrarySummaryCards } from "@/features/books/components/library-summary-cards";
import { formatNumber } from "@/lib/format";

import { publisherPriceLabel } from "../model/publisher-format";

const SUMMARY_CARD_COUNT = 4;

type PublisherSummaryCardsProps = {
  cards: LibrarySummaryCard[];
  isError: boolean;
  isLoading: boolean;
  mobileAction?: ReactNode;
  onRetry: () => void;
};

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
      skeletonCount={SUMMARY_CARD_COUNT}
    />
  );
}

export function usePublisherSummaryCards(
  summary: LibraryPublishersSummary | undefined,
): LibrarySummaryCard[] {
  const t = useTranslations("publishers.summary");
  const locale = useLocale();

  const mobileLabels = (key: "averageRating" | "booksWithPublisher" | "publishers" | "toBuy") => ({
    compact: t(`mobile.compact.${key}`),
    detailed: t(`mobile.detailed.${key}`),
  });

  if (summary === undefined) return [];

  const priceTotals: ReactNode =
    summary.expectedPriceTotals.length === 0 ? undefined : (
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {summary.expectedPriceTotals.map((total) => (
          <li className="tabular-nums" key={total.currency}>
            {t("priceTotal", {
              count: total.pricedBooksCount,
              price: publisherPriceLabel(total.amount, total.currency, locale),
            })}
          </li>
        ))}
      </ul>
    );

  return [
    {
      icon: "building",
      iconTone: "primary",
      label: t("publishers"),
      mobileLabels: mobileLabels("publishers"),
      value: formatNumber(summary.publishersCount, locale),
    },
    {
      icon: "book",
      iconTone: "info",
      label: t("booksWithPublisher"),
      mobileLabels: mobileLabels("booksWithPublisher"),
      value: formatNumber(summary.booksWithPublisherCount, locale),
    },
    {
      icon: "star",
      iconTone: "favorite",
      label: t("averageRating"),
      microfact: t("ratedBooks", { count: summary.ratedBooksCount }),
      mobileLabels: mobileLabels("averageRating"),
      value:
        summary.averageBookRating === null
          ? t("noRating")
          : formatNumber(summary.averageBookRating, locale, {
              maximumFractionDigits: 1,
              minimumFractionDigits: 1,
            }),
    },
    {
      icon: "cart",
      iconTone: "success",
      label: t("toBuy"),
      microfact: priceTotals,
      mobileLabels: mobileLabels("toBuy"),
      value: formatNumber(summary.wantToBuyBooksCount, locale),
    },
  ];
}
