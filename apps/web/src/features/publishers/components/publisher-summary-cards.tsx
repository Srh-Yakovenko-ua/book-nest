"use client";

import type { LibraryPublishersSummary } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { formatNumber } from "@/lib/format";

import { publisherPriceLabel } from "../model/publisher-format";

const SUMMARY_CARD_COUNT = 4;

type PublisherSummaryCardsProps = {
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
  summary: LibraryPublishersSummary | undefined;
};

export function PublisherSummaryCards({
  isError,
  isLoading,
  onRetry,
  summary,
}: PublisherSummaryCardsProps) {
  const t = useTranslations("publishers.summary");
  const locale = useLocale();

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

  if (isLoading || summary === undefined) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: SUMMARY_CARD_COUNT }, (_, index) => (
          <SummaryCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <StatCard
        icon="building"
        label={t("publishers")}
        size="compact"
        value={formatNumber(summary.publishersCount, locale)}
      />
      <StatCard
        icon="book"
        label={t("booksWithPublisher")}
        size="compact"
        value={formatNumber(summary.booksWithPublisherCount, locale)}
      />
      <StatCard
        caption={t("ratedBooks", { count: summary.ratedBooksCount })}
        icon="star"
        iconTone="favorite"
        label={t("averageRating")}
        size="compact"
        value={
          summary.averageBookRating === null
            ? t("noRating")
            : formatNumber(summary.averageBookRating, locale, {
                maximumFractionDigits: 1,
                minimumFractionDigits: 1,
              })
        }
      />
      <StatCard
        icon="cart"
        label={t("toBuy")}
        microfact={
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
          )
        }
        size="compact"
        value={formatNumber(summary.wantToBuyBooksCount, locale)}
      />
    </div>
  );
}

function SummaryCardSkeleton() {
  return (
    <Card className="flex flex-row items-center gap-2.5 border border-border bg-card px-3 py-3 shadow-card sm:gap-3 sm:px-4 sm:py-3.5">
      <Skeleton className="size-10 shrink-0 rounded-full sm:size-11" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-6 w-12" />
      </div>
    </Card>
  );
}
