"use client";

import type { BookView, ReadingActivityRange, ReadingHistorySort } from "@app/shared";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { useReadingHistory } from "../../api/use-reading-history";
import { ReadingActivitySection } from "../reading-progress/reading-activity-section";
import { ReadingProgressEmpty } from "../reading-progress/reading-progress-empty";
import { ReadingHistoryError } from "../reading/reading-history-error";
import { hasReadingProgress } from "../reading/reading-progress-guard";
import { ReadingHistoryEmptyState } from "./reading-history-empty-state";
import { ReadingHistoryHeader } from "./reading-history-header";
import { ReadingHistoryList } from "./reading-history-list";
import { ReadingHistoryOverview } from "./reading-history-overview";
import { ReadingHistorySkeleton } from "./reading-history-skeleton";

type ReadingHistoryTabProps = {
  book: BookView;
  isActive: boolean;
};

export function ReadingHistoryTab({ book, isActive }: ReadingHistoryTabProps) {
  const t = useTranslations("books.details.reading");
  const [activityRange, setActivityRange] = useState<ReadingActivityRange>("7d");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ReadingHistorySort>("desc");
  const [expandedDates, setExpandedDates] = useState<ReadonlySet<string>>(() => new Set());
  const headingRef = useRef<HTMLHeadingElement>(null);

  const query = useReadingHistory(
    book.id,
    { activityRange, limit: 20, page, sort },
    { enabled: isActive },
  );

  const maxPage = Math.max(1, query.data?.history.pagination.totalPages ?? 1);

  if (query.data !== undefined && page > maxPage) {
    setPage(maxPage);
  }

  function handleSortChange(next: ReadingHistorySort) {
    setSort(next);
    setPage(1);
    setExpandedDates(new Set());
  }

  function handlePageChange(next: number) {
    setPage(next);
    setExpandedDates(new Set());
    headingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleToggleDay(date: string, open: boolean) {
    setExpandedDates((previous) => {
      const next = new Set(previous);
      if (open) next.add(date);
      else next.delete(date);
      return next;
    });
  }

  if (query.isPending) return <ReadingHistorySkeleton />;

  if (query.data === undefined) {
    return <ReadingHistoryError onRetry={() => void query.refetch()} />;
  }

  const { activity, history, summary } = query.data;

  if (!hasReadingProgress(summary)) {
    return (
      <div className="flex flex-col gap-6">
        <ReadingHistoryHeader />
        <ReadingHistoryEmptyState />
      </div>
    );
  }

  const isLegacy = summary.updatesCount === 0;
  const isRefetching = query.isFetching && query.isPlaceholderData;

  return (
    <div className="flex flex-col gap-6">
      {query.isError ? <ReadingHistoryError onRetry={() => void query.refetch()} /> : null}

      <ReadingHistoryHeader />
      <ReadingHistoryOverview summary={summary} />

      {isLegacy ? (
        <ReadingProgressEmpty icon="clock" message={t("legacyNoHistory")} />
      ) : (
        <>
          <ReadingActivitySection
            activity={activity}
            chartClassName="h-56 sm:h-64"
            isRefetching={isRefetching}
            onRangeChange={setActivityRange}
            range={activityRange}
          />
          <ReadingHistoryList
            days={history.days}
            expandedDates={expandedDates}
            headingRef={headingRef}
            isRefetching={isRefetching}
            onPageChange={handlePageChange}
            onSortChange={handleSortChange}
            onToggleDay={handleToggleDay}
            pagination={history.pagination}
            sort={sort}
          />
        </>
      )}
    </div>
  );
}
