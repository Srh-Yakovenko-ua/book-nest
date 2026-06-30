"use client";

import { useQueryStates } from "nuqs";

import type { BooksControllerListSort } from "@/shared/api/generated/model";

import type { LibraryListParams, LibraryQueryState, LibraryViewMode } from "./library-query";

import {
  hasActiveLibraryFilters,
  hasActiveLibrarySearch,
  LIBRARY_FILTERS_RESET,
  libraryQueryParsers,
  toLibraryListParams,
} from "./library-query";

export type UseLibraryQueryResult = {
  clearAll: () => void;
  clearFilters: () => void;
  clearSearch: () => void;
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  listParams: LibraryListParams;
  setSearch: (value: string) => void;
  setSort: (value: BooksControllerListSort) => void;
  setState: ReturnType<typeof useQueryStates<typeof libraryQueryParsers>>[1];
  setView: (value: LibraryViewMode) => void;
  sort: BooksControllerListSort;
  state: LibraryQueryState;
  view: LibraryViewMode;
};

export function useLibraryQuery(): UseLibraryQueryResult {
  const [state, setState] = useQueryStates(libraryQueryParsers);

  return {
    clearAll: () => void setState({ q: null, ...LIBRARY_FILTERS_RESET }),
    clearFilters: () => void setState(LIBRARY_FILTERS_RESET),
    clearSearch: () => void setState({ q: null }),
    hasActiveFilters: hasActiveLibraryFilters(state),
    hasActiveSearch: hasActiveLibrarySearch(state),
    listParams: toLibraryListParams(state),
    setSearch: (value) => void setState({ q: value }),
    setSort: (value) => void setState({ sort: value }),
    setState,
    setView: (value) => void setState({ view: value }),
    sort: state.sort,
    state,
    view: state.view,
  };
}
