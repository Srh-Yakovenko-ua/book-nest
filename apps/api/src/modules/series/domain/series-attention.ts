import type {
  OwnershipStatus,
  SeriesAttentionCounts,
  SeriesAttentionReason,
  SeriesView,
} from "@app/shared";

const NEXT_BOOK_UNAVAILABLE_OWNERSHIP: ReadonlySet<OwnershipStatus> = new Set<OwnershipStatus>([
  "in_transit",
  "lent_to_someone",
  "want_to_buy",
]);

const ATTENTION_REASONS = [
  "empty",
  "unknown_status",
  "missing_parts",
  "incomplete_set",
  "next_unavailable",
  "incomplete_data",
] as const satisfies readonly SeriesAttentionReason[];

const ATTENTION_PREDICATES: Record<SeriesAttentionReason, (series: SeriesView) => boolean> = {
  empty: (series) => series.booksInSeries === 0,
  incomplete_data: (series) => series.authors.length === 0 || series.genres.length === 0,
  incomplete_set: (series) =>
    series.status === "completed" &&
    series.totalBooks !== null &&
    series.booksInSeries < series.totalBooks,
  missing_parts: (series) => series.missingPartNumbers.length > 0,
  next_unavailable: (series) => {
    const ownershipStatus = series.nextBook?.ownershipStatus;
    if (ownershipStatus === null || ownershipStatus === undefined) {
      return false;
    }
    return NEXT_BOOK_UNAVAILABLE_OWNERSHIP.has(ownershipStatus);
  },
  unknown_status: (series) => series.status === "unknown",
};

export function countSeriesAttention(items: readonly SeriesView[]): SeriesAttentionCounts {
  const counts: SeriesAttentionCounts = {
    empty: 0,
    incomplete_data: 0,
    incomplete_set: 0,
    missing_parts: 0,
    next_unavailable: 0,
    unknown_status: 0,
  };

  for (const series of items) {
    for (const reason of seriesAttentionReasons(series)) {
      counts[reason] += 1;
    }
  }

  return counts;
}

export function selectAlmostReadSeries({
  excludeId,
  items,
  limit,
}: {
  excludeId: string | undefined;
  items: readonly SeriesView[];
  limit: number;
}): SeriesView[] {
  return items
    .filter((series) => series.id !== excludeId)
    .filter((series) => series.nextBook !== null)
    .filter((series) => {
      const percent = seriesProgressPercent(series);
      return percent > 0 && percent < 100;
    })
    .sort((first, second) => {
      const leftFirst = booksLeft(first);
      const leftSecond = booksLeft(second);
      if (leftFirst !== leftSecond) {
        return leftFirst - leftSecond;
      }
      return seriesProgressPercent(second) - seriesProgressPercent(first);
    })
    .slice(0, limit);
}

export function seriesAttentionReasons(series: SeriesView): SeriesAttentionReason[] {
  return ATTENTION_REASONS.filter((reason) => ATTENTION_PREDICATES[reason](series));
}

export function seriesProgressPercent(series: SeriesView): number {
  const denominator = series.totalBooks ?? series.booksInSeries;
  if (series.booksInSeries === 0 || denominator <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((series.finishedInSeries / denominator) * 100));
}

function booksLeft(series: SeriesView): number {
  return (series.totalBooks ?? series.booksInSeries) - series.finishedInSeries;
}
