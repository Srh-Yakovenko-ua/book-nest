"use client";

import type { Nullable } from "@app/shared";

import { useQueryStates } from "nuqs";

import type { ListBookSortOption } from "./list-book-sort";
import type {
  ListDetailBooksParams,
  ListDetailEmptyReason,
  ListDetailQueryState,
  ListDetailViewMode,
} from "./list-detail-query";
import type { ListDetailTab } from "./list-detail-tabs";

import {
  hasActiveListDetailFilters,
  hasActiveListDetailSearch,
  LIST_DETAIL_FILTERS_RESET,
  listDetailEmptyReason,
  listDetailQueryParsers,
  toListDetailParams,
} from "./list-detail-query";
import { activeListDetailTab, listDetailTabPatch } from "./list-detail-tabs";

export type UseListDetailQueryResult = {
  clearAll: () => void;
  clearFilters: () => void;
  clearSearch: () => void;
  emptyReason: ListDetailEmptyReason;
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  params: ListDetailBooksParams;
  selectTab: (tab: ListDetailTab) => void;
  setSearch: (value: string) => void;
  setSort: (value: ListBookSortOption) => void;
  setState: ReturnType<typeof useQueryStates<typeof listDetailQueryParsers>>[1];
  setView: (value: ListDetailViewMode) => void;
  state: ListDetailQueryState;
  tab: Nullable<ListDetailTab>;
};

export function useListDetailQuery(): UseListDetailQueryResult {
  const [state, setState] = useQueryStates(listDetailQueryParsers);

  return {
    clearAll: () => void setState({ q: null, ...LIST_DETAIL_FILTERS_RESET }),
    clearFilters: () => void setState(LIST_DETAIL_FILTERS_RESET),
    clearSearch: () => void setState({ q: null }),
    emptyReason: listDetailEmptyReason(state),
    hasActiveFilters: hasActiveListDetailFilters(state),
    hasActiveSearch: hasActiveListDetailSearch(state),
    params: toListDetailParams(state),
    selectTab: (tab) => void setState(listDetailTabPatch(tab)),
    setSearch: (value) => void setState({ q: value === "" ? null : value }),
    setSort: (value) => void setState({ sort: value }),
    setState,
    setView: (value) => void setState({ view: value }),
    state,
    tab: activeListDetailTab(state),
  };
}
