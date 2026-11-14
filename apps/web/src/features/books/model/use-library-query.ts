"use client";

import type { Nullable } from "@app/shared";

import { useQueryStates } from "nuqs";

import type { BooksControllerListSort } from "@/shared/api/generated/model";

import type {
  LibraryListParams,
  LibraryPublisherContext,
  LibraryQueryState,
  LibraryRangeKey,
  LibraryScope,
  LibraryViewMode,
} from "./library-query";

import {
  favoritesQueryParsers,
  hasActiveLibraryFilters,
  hasActiveLibrarySearch,
  invertedLibraryRanges,
  invertedRangesReset,
  LIBRARY_FILTERS_RESET,
  libraryQueryParsers,
  toLibraryListParams,
  withoutPublisherFilters,
} from "./library-query";

export type LibraryInvalidRange = {
  onClear: () => void;
  ranges: LibraryRangeKey[];
};

export type UseLibraryQueryResult = {
  clearAll: () => void;
  clearFilters: () => void;
  clearSearch: () => void;
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  invalidRange: Nullable<LibraryInvalidRange>;
  listParams: LibraryListParams;
  setSearch: (value: string) => void;
  setSort: (value: BooksControllerListSort) => void;
  setState: ReturnType<typeof useQueryStates<typeof libraryQueryParsers>>[1];
  setView: (value: LibraryViewMode) => void;
  sort: BooksControllerListSort;
  state: LibraryQueryState;
  view: LibraryViewMode;
};

export function useLibraryQuery(
  scope: LibraryScope,
  context?: LibraryPublisherContext,
): UseLibraryQueryResult {
  const parsers: typeof libraryQueryParsers =
    scope === "favorites" ? favoritesQueryParsers : libraryQueryParsers;
  const [urlState, setState] = useQueryStates(parsers);
  const state = context === undefined ? urlState : withoutPublisherFilters(urlState);
  const invertedRanges = invertedLibraryRanges(state);

  return {
    clearAll: () => void setState({ q: null, ...LIBRARY_FILTERS_RESET }),
    clearFilters: () => void setState(LIBRARY_FILTERS_RESET),
    clearSearch: () => void setState({ q: null }),
    hasActiveFilters: hasActiveLibraryFilters(state),
    hasActiveSearch: hasActiveLibrarySearch(state),
    invalidRange:
      invertedRanges.length === 0
        ? null
        : { onClear: () => void setState(invertedRangesReset(state)), ranges: invertedRanges },
    listParams: toLibraryListParams(state, scope, context),
    setSearch: (value) => void setState({ q: value }),
    setSort: (value) => void setState({ sort: value }),
    setState,
    setView: (value) => void setState({ view: value }),
    sort: state.sort,
    state,
    view: state.view,
  };
}
