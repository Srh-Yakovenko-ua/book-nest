"use client";

import { useQueryStates } from "nuqs";

import type { SeriesControllerSearchParams } from "@/shared/api/generated/model";

import type { SeriesQueryState } from "./series-query";

import {
  countActiveSeriesQueryFilters,
  hasActiveSeriesSearch,
  SERIES_FILTERS_RESET,
  seriesQueryParsers,
  toSeriesListParams,
} from "./series-query";

export type UseSeriesQueryResult = {
  activeFilterCount: number;
  clearAll: () => void;
  hasActiveQuery: boolean;
  listParams: SeriesControllerSearchParams;
  setState: ReturnType<typeof useQueryStates<typeof seriesQueryParsers>>[1];
  state: SeriesQueryState;
};

export function useSeriesQuery(): UseSeriesQueryResult {
  const [state, setState] = useQueryStates(seriesQueryParsers);
  const activeFilterCount = countActiveSeriesQueryFilters(state);

  return {
    activeFilterCount,
    clearAll: () => void setState({ q: null, ...SERIES_FILTERS_RESET }),
    hasActiveQuery: activeFilterCount > 0 || hasActiveSeriesSearch(state),
    listParams: toSeriesListParams(state),
    setState,
    state,
  };
}
