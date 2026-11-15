"use client";

import type { QuotesSummaryView } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";

import type { SummaryCard } from "@/components/catalog/summary-cards";

import { SummaryCards } from "@/components/catalog/summary-cards";
import { SummaryError } from "@/components/summary-error";
import { formatNumber } from "@/lib/format";

type QuotesSummaryCardKey = "averagePerBook" | "quotedBooks" | "topAuthor" | "topBook";

type QuotesSummaryCardsProps = {
  cards: SummaryCard[];
  isError: boolean;
  isLoading: boolean;
  mobileAction?: ReactNode;
  onRetry: () => void;
};

const AVERAGE = {
  maximumFractionDigits: 1,
} as const;

const EMPTY_SUMMARY: QuotesSummaryView = {
  averageQuotesPerQuotedBook: null,
  favoritesCount: 0,
  quotedBooksCount: 0,
  spoilerCount: 0,
  topAuthor: null,
  topBook: null,
  totalCount: 0,
  withCommentCount: 0,
  withoutSpoilerCount: 0,
};

export function QuotesSummaryCards({
  cards,
  isError,
  isLoading,
  mobileAction,
  onRetry,
}: QuotesSummaryCardsProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <SummaryError state={isError ? { onRetry } : null}>
        <SummaryCards
          cards={cards}
          isLoading={isLoading}
          mobileAction={mobileAction}
          mobileLayout="compact"
        />
      </SummaryError>
      {isError ? <div className="empty:hidden sm:hidden">{mobileAction}</div> : null}
    </div>
  );
}

export function useQuotesSummaryCards(summary?: QuotesSummaryView): SummaryCard[] {
  const t = useTranslations("quotes.summary");
  const locale = useLocale();

  const stats = summary ?? EMPTY_SUMMARY;
  const { averageQuotesPerQuotedBook, topAuthor, topBook } = stats;

  const average =
    averageQuotesPerQuotedBook === null ? null : roundToShownPrecision(averageQuotesPerQuotedBook);

  const mobileLabels = (key: QuotesSummaryCardKey) => ({
    compact: t(`mobile.compact.${key}`),
    detailed: t(`mobile.detailed.${key}`),
  });

  const topBookMicrofact = () => {
    if (topBook === null) return t("noQuotesYet");
    if (topBook.title !== null) return topBook.title;
    if (topBook.quotesCount === 1 && topBook.leadersCount === stats.quotedBooksCount) {
      return t("allBooksSingleQuote");
    }
    return t("topBookLeaders", { count: topBook.leadersCount });
  };

  const topAuthorMicrofact = () => {
    if (topAuthor === null) return stats.totalCount === 0 ? t("noQuotesYet") : t("noAuthorData");
    if (topAuthor.name !== null) return topAuthor.name;
    return t("topAuthorLeaders", { count: topAuthor.leadersCount });
  };

  const quotedBooksCard: SummaryCard = {
    icon: "library-big",
    iconTone: "primary",
    label: t("quotedBooks"),
    microfact: (
      <ClampedMicrofact>
        {stats.totalCount === 0 ? t("noQuotesYet") : t("quotesTotal", { count: stats.totalCount })}
      </ClampedMicrofact>
    ),
    mobileLabels: mobileLabels("quotedBooks"),
    unit: t("booksUnit", { count: stats.quotedBooksCount }),
    value: stats.quotedBooksCount,
  };

  const averageCard: SummaryCard = {
    icon: "chart",
    iconTone: "info",
    label: t("averagePerBook"),
    microfact: (
      <ClampedMicrofact>
        {average === null ? t("noDataYet") : t("amongBooks", { count: stats.quotedBooksCount })}
      </ClampedMicrofact>
    ),
    mobileLabels: mobileLabels("averagePerBook"),
    unit: average === null ? undefined : t("quotesUnit", { count: average }),
    value:
      average === null
        ? t("empty")
        : formatNumber(average, locale, {
            maximumFractionDigits: AVERAGE.maximumFractionDigits,
          }),
  };

  const topBookCard: SummaryCard = {
    icon: "book-open-text",
    iconTone: "ink",
    label: t("topBook"),
    microfact: <ClampedMicrofact>{topBookMicrofact()}</ClampedMicrofact>,
    mobileLabels: mobileLabels("topBook"),
    unit: topBook === null ? undefined : t("quotesUnit", { count: topBook.quotesCount }),
    value: topBook === null ? t("empty") : topBook.quotesCount,
  };

  const topAuthorCard: SummaryCard = {
    icon: "user-round",
    iconTone: "genre",
    label: t("topAuthor"),
    microfact: <ClampedMicrofact>{topAuthorMicrofact()}</ClampedMicrofact>,
    mobileLabels: mobileLabels("topAuthor"),
    unit: topAuthor === null ? undefined : t("quotesUnit", { count: topAuthor.quotesCount }),
    value: topAuthor === null ? t("empty") : topAuthor.quotesCount,
  };

  return [quotedBooksCard, averageCard, topBookCard, topAuthorCard];
}

function ClampedMicrofact({ children }: { children: ReactNode }) {
  return <span className="line-clamp-2 break-words">{children}</span>;
}

function roundToShownPrecision(value: number): number {
  const factor = 10 ** AVERAGE.maximumFractionDigits;
  return Math.round(value * factor) / factor;
}
