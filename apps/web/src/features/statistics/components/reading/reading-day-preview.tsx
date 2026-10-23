"use client";

import type { StatisticsCalendarDay } from "@app/shared";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { StatisticsBookCover } from "../details/statistics-book-cover";

export function ReadingDayPreview({
  className,
  coverClassName = "w-6",
  coverLimit,
  day,
}: {
  className?: string;
  coverClassName?: string;
  coverLimit?: number;
  day: StatisticsCalendarDay;
}) {
  const t = useTranslations("statistics.calendar.books");

  const covers =
    coverLimit === undefined ? day.booksPreview : day.booksPreview.slice(0, coverLimit);
  const hiddenCount = day.remainingBooksCount + day.booksPreview.length - covers.length;

  return (
    <span className={cn("flex items-center gap-1", className)}>
      {covers.map((book) => (
        <StatisticsBookCover
          className={coverClassName}
          coverThumbUrl={book.coverThumbUrl}
          key={book.bookId}
          title={book.title}
        />
      ))}
      {hiddenCount === 0 ? null : (
        <span className="text-[0.625rem] font-medium text-muted-foreground tabular-nums">
          {t("more", { count: hiddenCount })}
        </span>
      )}
    </span>
  );
}
