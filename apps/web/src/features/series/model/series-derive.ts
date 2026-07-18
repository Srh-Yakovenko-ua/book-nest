import type { SeriesStatus, SeriesView } from "@app/shared";

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
  | "activity_desc"
  | "books_desc"
  | "name_asc"
  | "name_desc"
  | "progress_asc"
  | "progress_desc";

export type SeriesStatusFilter = "all" | SeriesStatus;

export type SeriesTab = "all" | "unfinished";

export const SERIES_TABS = ["all", "unfinished"] as const satisfies readonly SeriesTab[];

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

export function filterSeries({
  items,
  readingFilter,
  search,
  statusFilter,
  tab,
}: {
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
    return seriesMatchesSearch({ query: search, series });
  });
}

export function isSeriesStarted(series: SeriesView): boolean {
  return series.finishedInSeries > 0 || series.readingInSeries > 0;
}

export function isSeriesUnfinished(series: SeriesView): boolean {
  const isMultiBook = series.booksInSeries > 1 || (series.totalBooks ?? 0) > 1;
  return isMultiBook && isSeriesStarted(series) && !seriesProgress(series).fullyRead;
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
