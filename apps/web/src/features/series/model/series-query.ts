import {
  type inferParserType,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import type { SeriesControllerSearchParams } from "@/shared/api/generated/model";

import {
  SeriesControllerSearchAttention,
  SeriesControllerSearchCompletenessItem,
  SeriesControllerSearchReading,
  SeriesControllerSearchSort,
  SeriesControllerSearchStatus,
  SeriesControllerSearchTab,
} from "@/shared/api/generated/model";

import type { SeriesAdvancedFilters } from "./series-derive";

export const SERIES_ATTENTION_VALUES = Object.values(SeriesControllerSearchAttention);
export const SERIES_COMPLETENESS_PARAM_VALUES = Object.values(
  SeriesControllerSearchCompletenessItem,
);
export const SERIES_READING_PARAM_VALUES = Object.values(SeriesControllerSearchReading);
export const SERIES_SORT_PARAM_VALUES = Object.values(SeriesControllerSearchSort);
export const SERIES_STATUS_PARAM_VALUES = Object.values(SeriesControllerSearchStatus);
export const SERIES_TAB_VALUES = Object.values(SeriesControllerSearchTab);

export const seriesQueryParsers = {
  attention: parseAsStringLiteral(SERIES_ATTENTION_VALUES),
  authorIds: parseAsArrayOf(parseAsString).withDefault([]),
  booksMax: parseAsInteger,
  booksMin: parseAsInteger,
  completeness: parseAsArrayOf(parseAsStringLiteral(SERIES_COMPLETENESS_PARAM_VALUES)).withDefault(
    [],
  ),
  genres: parseAsArrayOf(parseAsString).withDefault([]),
  progressMax: parseAsInteger,
  progressMin: parseAsInteger,
  q: parseAsString.withDefault(""),
  reading: parseAsStringLiteral(SERIES_READING_PARAM_VALUES),
  sort: parseAsStringLiteral(SERIES_SORT_PARAM_VALUES).withDefault(
    SeriesControllerSearchSort.name_asc,
  ),
  status: parseAsStringLiteral(SERIES_STATUS_PARAM_VALUES),
  tab: parseAsStringLiteral(SERIES_TAB_VALUES).withDefault(SeriesControllerSearchTab.all),
};

export type SeriesQueryState = inferParserType<typeof seriesQueryParsers>;

export const SERIES_FILTERS_RESET = {
  attention: null,
  authorIds: null,
  booksMax: null,
  booksMin: null,
  completeness: null,
  genres: null,
  progressMax: null,
  progressMin: null,
  reading: null,
  status: null,
};

export function countActiveSeriesQueryFilters(state: SeriesQueryState): number {
  const collections = [state.authorIds, state.completeness, state.genres];
  const singles = [state.attention, state.reading, state.status];
  const ranges = [
    [state.booksMin, state.booksMax],
    [state.progressMin, state.progressMax],
  ];

  return (
    collections.filter((value) => value.length > 0).length +
    singles.filter((value) => value !== null).length +
    ranges.filter(([min, max]) => min !== null || max !== null).length
  );
}

export function hasActiveSeriesSearch(state: SeriesQueryState): boolean {
  return state.q.trim() !== "";
}

export function toSeriesAdvancedFilters(state: SeriesQueryState): SeriesAdvancedFilters {
  return {
    authorIds: state.authorIds,
    booksMax: state.booksMax,
    booksMin: state.booksMin,
    completeness: state.completeness,
    genres: state.genres,
    progressMax: state.progressMax,
    progressMin: state.progressMin,
  };
}

export function toSeriesFilterPatch(filters: SeriesAdvancedFilters) {
  return {
    authorIds: filters.authorIds.length === 0 ? null : filters.authorIds,
    booksMax: filters.booksMax,
    booksMin: filters.booksMin,
    completeness: filters.completeness.length === 0 ? null : filters.completeness,
    genres: filters.genres.length === 0 ? null : filters.genres,
    progressMax: filters.progressMax,
    progressMin: filters.progressMin,
  };
}

export function toSeriesListParams(state: SeriesQueryState): SeriesControllerSearchParams {
  const search = state.q.trim();
  const booksInverted = isInvertedRange({ max: state.booksMax, min: state.booksMin });
  const progressInverted = isInvertedRange({ max: state.progressMax, min: state.progressMin });

  return {
    authorIds: state.authorIds,
    completeness: state.completeness,
    genres: state.genres,
    sort: state.sort,
    tab: state.tab,
    ...(state.attention === null ? {} : { attention: state.attention }),
    ...(state.reading === null ? {} : { reading: state.reading }),
    ...(state.status === null ? {} : { status: state.status }),
    ...(search === "" ? {} : { search }),
    ...boundedRange({
      inverted: booksInverted,
      key: "books",
      max: state.booksMax,
      min: state.booksMin,
    }),
    ...boundedRange({
      inverted: progressInverted,
      key: "progress",
      max: state.progressMax,
      min: state.progressMin,
    }),
  };
}

function boundedRange({
  inverted,
  key,
  max,
  min,
}: {
  inverted: boolean;
  key: "books" | "progress";
  max: null | number;
  min: null | number;
}): Record<string, number> {
  if (inverted) return {};
  return {
    ...(min === null ? {} : { [`${key}Min`]: min }),
    ...(max === null ? {} : { [`${key}Max`]: max }),
  };
}

function isInvertedRange({ max, min }: { max: null | number; min: null | number }): boolean {
  return min !== null && max !== null && min > max;
}
