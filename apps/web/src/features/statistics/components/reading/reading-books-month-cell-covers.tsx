"use client";

import type { StatisticsCalendarBookPreview, StatisticsCalendarDay } from "@app/shared";

import { CALENDAR_BOOKS_PREVIEW_LIMIT } from "@app/shared";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { BookCoverFallback } from "@/components/book-cover-fallback";
import { cn } from "@/lib/utils";

const POSTER_CLASS = {
  cover: "object-cover",
  fallback: "size-full",
  frame: "absolute inset-0 grid gap-0.5 bg-card",
  layouts: ["grid-cols-1", "grid-cols-2", "grid-cols-[55fr_45fr] grid-rows-2"],
  lead: "row-span-2",
  more: "absolute top-1 right-1 z-10 rounded-sm bg-card/90 px-1 py-0.5 text-[0.6875rem] leading-none font-semibold text-ink tabular-nums shadow-xs",
  slot: "relative min-h-0 min-w-0 overflow-hidden bg-secondary",
} as const;

export function ReadingBooksMonthCellCovers({ day }: { day: StatisticsCalendarDay }) {
  const t = useTranslations("statistics.calendar.books");
  const previews = day.booksPreview.slice(0, CALENDAR_BOOKS_PREVIEW_LIMIT);
  const hidden = hiddenBooksCount(day);

  if (previews.length === 0) return null;

  return (
    <>
      <span
        className={cn(POSTER_CLASS.frame, POSTER_CLASS.layouts[previews.length - 1])}
        data-poster-books={previews.length}
      >
        {previews.map((book, index) => (
          <PosterSlot
            book={book}
            className={
              isLeadSlot({ count: previews.length, index }) ? POSTER_CLASS.lead : undefined
            }
            key={book.bookId}
          />
        ))}
      </span>
      {hidden === 0 ? null : (
        <span className={POSTER_CLASS.more}>{t("more", { count: hidden })}</span>
      )}
    </>
  );
}

function hiddenBooksCount(day: StatisticsCalendarDay): number {
  const shown = Math.min(day.booksPreview.length, CALENDAR_BOOKS_PREVIEW_LIMIT);
  return Math.max(0, day.booksCount - shown);
}

function isLeadSlot({ count, index }: { count: number; index: number }): boolean {
  return count === CALENDAR_BOOKS_PREVIEW_LIMIT && index === 0;
}

function PosterSlot({
  book,
  className,
}: {
  book: StatisticsCalendarBookPreview;
  className?: string;
}) {
  return (
    <span className={cn(POSTER_CLASS.slot, className)} data-poster-slot={book.bookId}>
      {book.coverThumbUrl === null ? (
        <BookCoverFallback className={POSTER_CLASS.fallback} seed={book.bookId} sizes="7rem" />
      ) : (
        <Image
          alt=""
          className={POSTER_CLASS.cover}
          fill
          sizes="7rem"
          src={book.coverThumbUrl}
          unoptimized
        />
      )}
    </span>
  );
}
