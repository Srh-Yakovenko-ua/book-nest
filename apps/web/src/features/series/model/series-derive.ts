import type { OwnershipStatus, SeriesStatus, SeriesView } from "@app/shared";

export type SeriesAdvancedFilters = {
  authorIds: string[];
  booksMax: null | number;
  booksMin: null | number;
  completeness: SeriesCompleteness[];
  genres: string[];
  progressMax: null | number;
  progressMin: null | number;
};

export type SeriesAttentionFilter = "any" | SeriesAttentionReason;

export type SeriesAttentionReason =
  | "empty"
  | "incomplete_data"
  | "incomplete_set"
  | "missing_parts"
  | "next_unavailable"
  | "unknown_status";

export type SeriesCompleteness = "complete" | "incomplete" | "no_plan";

export type SeriesProgress = {
  denominator: number;
  finished: number;
  fullyRead: boolean;
  hasBooks: boolean;
  percent: number;
};

export type SeriesReadingFilter = "all" | SeriesReadingState;

export type SeriesReadingState = "completed" | "empty" | "in_progress" | "not_started";

export type SeriesSort =
  "activity_desc" | "books_desc" | "name_asc" | "name_desc" | "progress_asc" | "progress_desc";

export type SeriesStatusFilter = "all" | SeriesStatus;

export type SeriesTab = "all" | "unfinished";

export const SERIES_TABS = ["all", "unfinished"] as const satisfies readonly SeriesTab[];

export const SERIES_LIST_LAYOUTS = ["grid", "list"] as const;
export type SeriesListLayout = (typeof SERIES_LIST_LAYOUTS)[number];
export const SERIES_LIST_LAYOUT_DEFAULT: SeriesListLayout = "grid";

export const SERIES_SORT_OPTIONS = [
  "name_asc",
  "name_desc",
  "progress_desc",
  "progress_asc",
  "books_desc",
  "activity_desc",
] as const satisfies readonly SeriesSort[];

export const SERIES_SORT_DEFAULT: SeriesSort = "name_asc";

export const SERIES_STATUS_FILTERS = [
  "all",
  "completed",
  "ongoing",
  "unknown",
] as const satisfies readonly SeriesStatusFilter[];

export const SERIES_READING_FILTERS = [
  "all",
  "not_started",
  "in_progress",
  "completed",
  "empty",
] as const satisfies readonly SeriesReadingFilter[];

export const SERIES_COMPLETENESS_VALUES = [
  "complete",
  "incomplete",
  "no_plan",
] as const satisfies readonly SeriesCompleteness[];

export const SERIES_ATTENTION_REASONS = [
  "empty",
  "unknown_status",
  "missing_parts",
  "incomplete_set",
  "next_unavailable",
  "incomplete_data",
] as const satisfies readonly SeriesAttentionReason[];

export const EMPTY_SERIES_ADVANCED_FILTERS: SeriesAdvancedFilters = {
  authorIds: [],
  booksMax: null,
  booksMin: null,
  completeness: [],
  genres: [],
  progressMax: null,
  progressMin: null,
};

export function countActiveSeriesFilters(filters: SeriesAdvancedFilters): number {
  let count = 0;
  if (filters.authorIds.length > 0) count += 1;
  if (filters.completeness.length > 0) count += 1;
  if (filters.genres.length > 0) count += 1;
  if (filters.progressMin !== null || filters.progressMax !== null) count += 1;
  if (filters.booksMin !== null || filters.booksMax !== null) count += 1;
  return count;
}

const NEXT_BOOK_UNAVAILABLE_OWNERSHIP: ReadonlySet<OwnershipStatus> = new Set<OwnershipStatus>([
  "in_transit",
  "lent_to_someone",
  "want_to_buy",
]);

const SERIES_ATTENTION_PREDICATES: Record<SeriesAttentionReason, (series: SeriesView) => boolean> =
  {
    empty: (series) => series.booksInSeries === 0,
    incomplete_data: seriesHasIncompleteCoreData,
    incomplete_set: (series) =>
      series.status === "completed" &&
      series.totalBooks !== null &&
      series.booksInSeries < series.totalBooks,
    missing_parts: (series) => series.missingPartNumbers.length > 0,
    next_unavailable: seriesNextBookUnavailable,
    unknown_status: (series) => series.status === "unknown",
  };

export function countSeriesAttention(items: SeriesView[]): Record<SeriesAttentionReason, number> {
  const counts: Record<SeriesAttentionReason, number> = {
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

export function countSeriesNeedingAttention(items: SeriesView[]): number {
  return items.filter((series) => seriesAttentionReasons(series).length > 0).length;
}

export function filterSeries({
  advanced,
  attention,
  items,
  readingFilter,
  search,
  statusFilter,
  tab,
}: {
  advanced: SeriesAdvancedFilters;
  attention: null | SeriesAttentionFilter;
  items: SeriesView[];
  readingFilter: SeriesReadingFilter;
  search: string;
  statusFilter: SeriesStatusFilter;
  tab: SeriesTab;
}): SeriesView[] {
  return items.filter((series) => {
    if (tab === "unfinished" && !isSeriesUnfinished(series)) return false;
    if (statusFilter !== "all" && series.status !== statusFilter) return false;
    if (readingFilter !== "all" && seriesReadingState(series) !== readingFilter) return false;
    if (!seriesMatchesAdvancedFilters({ advanced, series })) return false;
    if (!seriesMatchesAttention({ attention, series })) return false;
    return seriesMatchesSearch({ query: search, series });
  });
}

export function hasActiveSeriesFilters(filters: SeriesAdvancedFilters): boolean {
  return countActiveSeriesFilters(filters) > 0;
}

export function isSeriesStarted(series: SeriesView): boolean {
  return series.finishedInSeries > 0 || series.readingInSeries > 0;
}

export function isSeriesUnfinished(series: SeriesView): boolean {
  const isMultiBook = series.booksInSeries > 1 || (series.totalBooks ?? 0) > 1;
  return isMultiBook && isSeriesStarted(series) && !seriesProgress(series).fullyRead;
}

export function selectAlmostReadSeries({
  excludeId,
  items,
}: {
  excludeId: string | undefined;
  items: SeriesView[];
}): SeriesView[] {
  return items
    .filter((series) => series.id !== excludeId)
    .filter((series) => series.nextBook !== null)
    .filter((series) => {
      const percent = seriesProgress(series).percent;
      return percent > 0 && percent < 100;
    })
    .sort((a, b) => {
      const progressA = seriesProgress(a);
      const progressB = seriesProgress(b);
      const leftA = progressA.denominator - progressA.finished;
      const leftB = progressB.denominator - progressB.finished;
      if (leftA !== leftB) return leftA - leftB;
      return progressB.percent - progressA.percent;
    })
    .slice(0, 3);
}

export function seriesAttentionReasons(series: SeriesView): SeriesAttentionReason[] {
  return SERIES_ATTENTION_REASONS.filter((reason) => SERIES_ATTENTION_PREDICATES[reason](series));
}

export function seriesCompleteness(series: SeriesView): SeriesCompleteness {
  if (series.totalBooks === null) return "no_plan";
  return series.booksInSeries >= series.totalBooks ? "complete" : "incomplete";
}

export function seriesHasIncompleteCoreData(series: SeriesView): boolean {
  if (series.authors.length === 0) return true;
  return series.genres.length === 0;
}

export function seriesMatchesAdvancedFilters({
  advanced,
  series,
}: {
  advanced: SeriesAdvancedFilters;
  series: SeriesView;
}): boolean {
  const percent = seriesProgress(series).percent;
  if (advanced.progressMin !== null && percent < advanced.progressMin) return false;
  if (advanced.progressMax !== null && percent > advanced.progressMax) return false;
  if (advanced.booksMin !== null && series.booksInSeries < advanced.booksMin) return false;
  if (advanced.booksMax !== null && series.booksInSeries > advanced.booksMax) return false;
  if (advanced.genres.length > 0 && !series.genres.some((key) => advanced.genres.includes(key))) {
    return false;
  }
  if (
    advanced.authorIds.length > 0 &&
    !series.authors.some((author) => advanced.authorIds.includes(author.id))
  ) {
    return false;
  }
  if (
    advanced.completeness.length > 0 &&
    !advanced.completeness.includes(seriesCompleteness(series))
  ) {
    return false;
  }
  return true;
}

export function seriesMatchesSearch({
  query,
  series,
}: {
  query: string;
  series: SeriesView;
}): boolean {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) return true;
  if (series.name.toLowerCase().includes(normalized)) return true;
  return series.authors.some((author) => author.name.toLowerCase().includes(normalized));
}

export function seriesProgress(series: SeriesView): SeriesProgress {
  const denominator = series.totalBooks ?? series.booksInSeries;
  const hasBooks = series.booksInSeries > 0;
  const percent =
    hasBooks && denominator > 0
      ? Math.min(100, Math.round((series.finishedInSeries / denominator) * 100))
      : 0;
  const fullyRead =
    hasBooks &&
    series.finishedInSeries === series.booksInSeries &&
    (series.totalBooks === null || series.finishedInSeries >= series.totalBooks);
  return { denominator, finished: series.finishedInSeries, fullyRead, hasBooks, percent };
}

export function seriesReadingState(series: SeriesView): SeriesReadingState {
  if (series.booksInSeries === 0) return "empty";
  if (seriesProgress(series).fullyRead) return "completed";
  if (!isSeriesStarted(series)) return "not_started";
  return "in_progress";
}

function seriesMatchesAttention({
  attention,
  series,
}: {
  attention: null | SeriesAttentionFilter;
  series: SeriesView;
}): boolean {
  if (attention === null) return true;
  const reasons = seriesAttentionReasons(series);
  if (attention === "any") return reasons.length > 0;
  return reasons.includes(attention);
}

function seriesNextBookUnavailable(series: SeriesView): boolean {
  const nextBook = series.nextBook;
  if (nextBook === null) return false;
  const ownershipStatus = nextBook.ownershipStatus;
  if (ownershipStatus === null || ownershipStatus === undefined) return false;
  return NEXT_BOOK_UNAVAILABLE_OWNERSHIP.has(ownershipStatus);
}

const SORT_COMPARATORS: Record<SeriesSort, (a: SeriesView, b: SeriesView) => number> = {
  activity_desc: (a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt),
  books_desc: (a, b) => b.booksInSeries - a.booksInSeries,
  name_asc: (a, b) => a.name.localeCompare(b.name),
  name_desc: (a, b) => b.name.localeCompare(a.name),
  progress_asc: (a, b) => seriesProgress(a).percent - seriesProgress(b).percent,
  progress_desc: (a, b) => seriesProgress(b).percent - seriesProgress(a).percent,
};

export function sortSeries({
  items,
  sort,
}: {
  items: SeriesView[];
  sort: SeriesSort;
}): SeriesView[] {
  return [...items].sort(SORT_COMPARATORS[sort]);
}
