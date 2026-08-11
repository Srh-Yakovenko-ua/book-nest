import type { SeriesStatus, SeriesView } from "@app/shared";

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
