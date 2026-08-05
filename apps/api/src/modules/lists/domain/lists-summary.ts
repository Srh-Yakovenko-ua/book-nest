import type { ListsSummaryView } from "@app/shared";

export type ListsSummaryCounts = Omit<ListsSummaryView, "averageBooksPerList" | "emptyListCount">;

export function toListsSummary(counts: ListsSummaryCounts): ListsSummaryView {
  return {
    ...counts,
    averageBooksPerList:
      counts.totalListCount === 0
        ? 0
        : Math.round(counts.totalMembershipCount / counts.totalListCount),
    emptyListCount: counts.totalListCount - counts.listsWithBooksCount,
  };
}
