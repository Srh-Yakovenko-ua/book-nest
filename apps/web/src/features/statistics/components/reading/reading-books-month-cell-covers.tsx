"use client";

import type { StatisticsCalendarDay } from "@app/shared";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { StatisticsBookCover } from "../details/statistics-book-cover";

const MONTH_CELL_COVERS_CLASS = {
  cover: "hidden shrink-0",
  coverImage: "w-8 rounded-xs ring-1 ring-border",
  more: "absolute right-px bottom-px hidden rounded-xs bg-card px-1 py-0.5 text-xs leading-none font-semibold text-ink tabular-nums ring-1 ring-border",
  stack: "relative flex min-w-0 flex-1 justify-end self-end overflow-hidden p-px",
  tiers: [
    { cover: "@lg/month-grid:block", more: "@lg/month-grid:block @2xl/month-grid:hidden" },
    { cover: "-ml-3 @2xl/month-grid:block", more: "@2xl/month-grid:block" },
  ],
} as const;

export function ReadingBooksMonthCellCovers({ day }: { day: StatisticsCalendarDay }) {
  const t = useTranslations("statistics.calendar.books");
  const booksTotal = day.booksPreview.length + day.remainingBooksCount;

  if (day.booksPreview.length === 0) return null;

  return (
    <span className={MONTH_CELL_COVERS_CLASS.stack}>
      {day.booksPreview.slice(0, MONTH_CELL_COVERS_CLASS.tiers.length).map((book, index) => (
        <span
          className={cn(MONTH_CELL_COVERS_CLASS.cover, MONTH_CELL_COVERS_CLASS.tiers[index]?.cover)}
          key={book.bookId}
        >
          <StatisticsBookCover
            className={MONTH_CELL_COVERS_CLASS.coverImage}
            coverThumbUrl={book.coverThumbUrl}
            title={book.title}
          />
        </span>
      ))}
      {MONTH_CELL_COVERS_CLASS.tiers.map((tier, index) => {
        const hiddenCount = booksTotal - Math.min(index + 1, day.booksPreview.length);
        return hiddenCount === 0 ? null : (
          <span className={cn(MONTH_CELL_COVERS_CLASS.more, tier.more)} key={tier.more}>
            {t("more", { count: hiddenCount })}
          </span>
        );
      })}
    </span>
  );
}
