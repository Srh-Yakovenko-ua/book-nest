"use client";

import type { GenreQuickFilter, GenreSort } from "@app/shared";

import { useQueryStates } from "nuqs";

import type {
  GenresAdvancedFilters,
  GenresDatasetParams,
  GenresListParams,
  GenresQueryState,
} from "./genres-query";

import {
  activeAdvancedFilterCount,
  advancedFiltersOf,
  committedGenresSearch,
  GENRES_QUERY_PARSERS,
  hasActiveGenresFilters,
  resetGenresFiltersPatch,
  toGenresAdvancedPatch,
  toGenresDatasetParams,
  toGenresListParams,
} from "./genres-query";

export type UseGenresQueryResult = {
  activeAdvancedCount: number;
  advancedFilters: GenresAdvancedFilters;
  applyAdvanced: (filters: GenresAdvancedFilters) => void;
  clearSearch: () => void;
  datasetParams: GenresDatasetParams;
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  listParams: GenresListParams;
  resetFilters: () => void;
  setFilter: (filter: GenreQuickFilter) => void;
  setSearch: (query: string) => void;
  setSort: (sort: GenreSort) => void;
  state: GenresQueryState;
};

export function useGenresQuery(): UseGenresQueryResult {
  const [state, setState] = useQueryStates(GENRES_QUERY_PARSERS);
  const advancedFilters = advancedFiltersOf(state);

  return {
    activeAdvancedCount: activeAdvancedFilterCount(advancedFilters),
    advancedFilters,
    applyAdvanced: (filters) => void setState(toGenresAdvancedPatch(filters)),
    clearSearch: () => void setState({ q: null }),
    datasetParams: toGenresDatasetParams(state),
    hasActiveFilters: hasActiveGenresFilters(state),
    hasActiveSearch: committedGenresSearch(state.q) !== "",
    listParams: toGenresListParams(state),
    resetFilters: () => void setState(resetGenresFiltersPatch()),
    setFilter: (filter) => void setState({ filter }),
    setSearch: (query) => void setState({ q: query === "" ? null : query }),
    setSort: (sort) => void setState({ sort }),
    state,
  };
}
