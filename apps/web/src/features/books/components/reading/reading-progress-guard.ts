import type { ReadingHistorySummaryView } from "@app/shared";

export function hasReadingProgress(summary: ReadingHistorySummaryView): boolean {
  return (
    summary.currentPage > 0 ||
    summary.startedAt !== null ||
    summary.activeDaysCount > 0 ||
    summary.updatesCount > 0 ||
    summary.finishedAt !== null ||
    summary.pausedAt !== null ||
    summary.abandonedAt !== null
  );
}
