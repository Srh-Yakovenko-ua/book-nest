"use client";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";

import { useReadingDayDetails } from "../../api/use-reading-day-details";
import { StatisticsStat } from "../statistics-stat";
import { StatisticsNote, StatisticsSectionState } from "../statistics-states";
import { StatisticsBookCover } from "./statistics-book-cover";

const DAY_DETAILS_CLASS = {
  panel: {
    bookTitle: "line-clamp-2 text-sm font-medium text-foreground",
    cover: "w-12 shrink-0",
    list: "flex flex-col gap-3",
    root: "flex flex-col gap-4",
  },
  surface: {
    bookTitle: "truncate text-sm font-medium text-foreground",
    cover: "w-9 shrink-0",
    list: "flex flex-col gap-2.5",
    root: "flex flex-col gap-3",
  },
} as const;

type ReadingDayDetailsVariant = keyof typeof DAY_DETAILS_CLASS;

export function ReadingDayDetails({
  date,
  onShowInBooksCalendar,
  variant = "surface",
}: {
  date: string;
  onShowInBooksCalendar?: () => void;
  variant?: ReadingDayDetailsVariant;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.details.day");
  const { data, isError, isPending, refetch } = useReadingDayDetails(date);

  if (isPending) {
    return (
      <output aria-busy="true" aria-label={t("loading")} className="flex flex-col gap-2">
        <Skeleton className="h-4 w-32 rounded-md" />
        <Skeleton className="h-14 w-full rounded-md" />
        <Skeleton className="h-14 w-full rounded-md" />
      </output>
    );
  }

  if (isError || data === undefined) {
    return (
      <StatisticsSectionState
        action={
          <button
            className="cursor-pointer text-xs font-medium text-primary underline"
            onClick={() => void refetch()}
            type="button"
          >
            {t("retry")}
          </button>
        }
        kind="error"
        title={t("error")}
      />
    );
  }

  const variantClass = DAY_DETAILS_CLASS[variant];
  const stats = [
    { label: t("booksLabel"), value: formatNumber(data.booksCount, locale) },
    { label: t("pagesLabel"), value: formatNumber(data.pagesRead, locale) },
  ];

  return (
    <div className={variantClass.root}>
      {variant === "panel" ? (
        <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
          {stats.map((stat) => (
            <div className="flex items-baseline gap-1.5" key={stat.label}>
              <dt className="text-muted-foreground">{stat.label}</dt>
              <dd className="font-semibold text-ink tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <dl className="grid grid-cols-2 gap-2">
          {stats.map((stat) => (
            <StatisticsStat key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </dl>
      )}

      {data.books.length === 0 ? (
        <StatisticsSectionState kind="empty" title={t("empty")} />
      ) : (
        <ul className={variantClass.list}>
          {data.books.map((book) => (
            <li className="flex items-center gap-3" key={book.bookId}>
              <StatisticsBookCover
                className={variantClass.cover}
                coverThumbUrl={book.coverThumbUrl}
                title={book.title}
              />
              <span className="flex min-w-0 flex-col">
                <span className={variantClass.bookTitle}>{book.title}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t("bookPages", { pages: book.pagesRead })}
                </span>
                {book.bookState === "soft_deleted" ? (
                  <span className="text-xs text-muted-foreground">{t("deletedBook")}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      {data.historyQuality === "legacy_observed_only" ? (
        <StatisticsNote>{t("legacyQuality")}</StatisticsNote>
      ) : null}

      {onShowInBooksCalendar === undefined ? null : (
        <Button
          className="self-start"
          onClick={onShowInBooksCalendar}
          size="sm"
          variant="secondary"
        >
          <UiIcon aria-hidden name="calendar" size={14} />
          {t("showInBooksCalendar")}
        </Button>
      )}
    </div>
  );
}
