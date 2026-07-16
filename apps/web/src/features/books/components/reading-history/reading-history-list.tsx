"use client";

import type {
  ReadingHistoryDayView,
  ReadingHistoryPaginationView,
  ReadingHistorySort,
} from "@app/shared";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { ReadingHistoryDay } from "./reading-history-day";
import { ReadingHistoryPagination } from "./reading-history-pagination";
import { ReadingHistorySortControl } from "./reading-history-sort";

type ReadingHistoryListProps = {
  days: ReadingHistoryDayView[];
  expandedDates: ReadonlySet<string>;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  isRefetching?: boolean;
  onPageChange: (page: number) => void;
  onSortChange: (sort: ReadingHistorySort) => void;
  onToggleDay: (date: string, open: boolean) => void;
  pagination: ReadingHistoryPaginationView;
  sort: ReadingHistorySort;
};

export function ReadingHistoryList({
  days,
  expandedDates,
  headingRef,
  isRefetching = false,
  onPageChange,
  onSortChange,
  onToggleDay,
  pagination,
  sort,
}: ReadingHistoryListProps) {
  const t = useTranslations("books.details.readingHistory");

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-heading text-base font-semibold text-ink" ref={headingRef}>
          {t("allUpdates")}
        </h3>
        <ReadingHistorySortControl onValueChange={onSortChange} value={sort} />
      </div>

      <div
        aria-busy={isRefetching}
        className={cn("flex flex-col gap-4 transition-opacity", isRefetching && "opacity-60")}
      >
        {days.length === 0 ? null : (
          <ul className="flex flex-col gap-2">
            {days.map((day) => (
              <ReadingHistoryDay
                day={day}
                key={day.date}
                onOpenChange={(open) => onToggleDay(day.date, open)}
                open={expandedDates.has(day.date)}
              />
            ))}
          </ul>
        )}

        <ReadingHistoryPagination onPageChange={onPageChange} pagination={pagination} />
      </div>
    </section>
  );
}
