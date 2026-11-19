"use client";

import type { ReadingDayDetails as ReadingDayDetailsView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useReadingDayDetails } from "../../api/use-reading-day-details";
import { StatisticsStat } from "../statistics-stat";
import { StatisticsNote, StatisticsSectionState } from "../statistics-states";
import { StatisticsBookCover } from "./statistics-book-cover";

const DAY_DETAILS_CLASS = {
  compact: {
    bookLink: null,
    bookTitle: "line-clamp-2 text-sm font-medium text-foreground",
    cover: "w-9 shrink-0",
    list: "flex flex-col gap-2",
    root: "flex flex-col gap-3",
    row: "flex items-center gap-3",
    soleCover: "w-12 shrink-0",
  },
  panel: {
    bookLink:
      "outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset",
    bookTitle: "line-clamp-2 text-sm font-medium break-words text-foreground",
    cover: "w-14 shrink-0",
    list: "-mx-1.5 flex max-h-96 flex-col gap-0.5 overflow-y-auto",
    root: "flex flex-col gap-3",
    row: "flex items-center gap-3 rounded-lg px-1.5 py-1",
    soleCover: "w-14 shrink-0",
  },
  surface: {
    bookLink: null,
    bookTitle: "truncate text-sm font-medium text-foreground",
    cover: "w-9 shrink-0",
    list: "flex flex-col gap-2.5",
    root: "flex flex-col gap-3",
    row: "flex items-center gap-3",
    soleCover: "w-9 shrink-0",
  },
} as const;

type ReadingDayBook = ReadingDayDetailsView["books"][number];

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

  return (
    <div className={variantClass.root}>
      <ReadingDayStats booksCount={data.booksCount} pagesRead={data.pagesRead} variant={variant} />

      {data.books.length === 0 ? (
        <StatisticsSectionState kind="empty" title={t("empty")} />
      ) : (
        <ul className={variantClass.list}>
          {data.books.map((book) => (
            <li key={book.bookId}>
              <ReadingDayBookRow book={book} isSole={data.books.length === 1} variant={variant} />
            </li>
          ))}
        </ul>
      )}

      {data.historyQuality === "legacy_observed_only" ? (
        <StatisticsNote>
          {variant === "surface" ? t("legacyQuality") : t("legacyQualityShort")}
        </StatisticsNote>
      ) : null}

      {onShowInBooksCalendar === undefined ? null : (
        <Button
          className="self-start"
          onClick={onShowInBooksCalendar}
          size="sm"
          variant={variant === "compact" ? "outline" : "secondary"}
        >
          <UiIcon aria-hidden name="calendar" size={14} />
          {t("showInBooksCalendar")}
        </Button>
      )}
    </div>
  );
}

function ReadingDayBookRow({
  book,
  isSole,
  variant,
}: {
  book: ReadingDayBook;
  isSole: boolean;
  variant: ReadingDayDetailsVariant;
}) {
  const t = useTranslations("statistics.details.day");
  const variantClass = DAY_DETAILS_CLASS[variant];
  const cover = (
    <StatisticsBookCover
      className={isSole ? variantClass.soleCover : variantClass.cover}
      coverThumbUrl={book.coverThumbUrl}
      title={book.title}
    />
  );
  const text = (
    <span className="flex min-w-0 flex-col">
      <span className={variantClass.bookTitle}>{book.title}</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {t("bookPages", { pages: book.pagesRead })}
      </span>
      {book.bookState === "soft_deleted" ? (
        <span className="text-xs text-muted-foreground">{t("deletedBook")}</span>
      ) : null}
    </span>
  );

  if (book.bookState === "active" && variantClass.bookLink !== null) {
    return (
      <Link className={cn(variantClass.row, variantClass.bookLink)} href={`/books/${book.bookId}`}>
        <span aria-hidden className="shrink-0">
          {cover}
        </span>
        {text}
      </Link>
    );
  }

  return (
    <div className={variantClass.row}>
      {cover}
      {text}
    </div>
  );
}

function ReadingDayStats({
  booksCount,
  pagesRead,
  variant,
}: {
  booksCount: number;
  pagesRead: number;
  variant: ReadingDayDetailsVariant;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.details.day");
  const stats = [
    { label: t("booksLabel"), value: formatNumber(booksCount, locale) },
    { label: t("pagesLabel"), value: formatNumber(pagesRead, locale) },
  ];

  switch (variant) {
    case "compact":
    case "panel":
      return (
        <dl className="flex items-center divide-x divide-border rounded-md bg-muted/60 py-2 text-sm">
          <div className="flex items-center px-3">
            <dt className="sr-only">{t("booksLabel")}</dt>
            <dd className="flex items-center gap-1.5 font-medium text-ink tabular-nums">
              <UiIcon aria-hidden className="text-primary" name="book" size={16} />
              {t("booksCount", { books: booksCount })}
            </dd>
          </div>
          <div className="flex items-center px-3">
            <dt className="sr-only">{t("pagesLabel")}</dt>
            <dd className="flex items-center gap-1.5 font-medium text-ink tabular-nums">
              <UiIcon aria-hidden className="text-primary" name="pages" size={16} />
              {t("bookPages", { pages: pagesRead })}
            </dd>
          </div>
        </dl>
      );
    case "surface":
      return (
        <dl className="grid grid-cols-2 gap-2">
          {stats.map((stat) => (
            <StatisticsStat key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </dl>
      );
  }
}
