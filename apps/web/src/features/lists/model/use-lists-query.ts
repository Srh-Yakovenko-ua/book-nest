"use client";

import { useQueryStates } from "nuqs";

import type {
  ListAttentionReason,
  ListsListParams,
  ListSort,
  ListsQueryState,
  ListViewMode,
} from "./lists-query";

import {
  hasActiveListFilters,
  LISTS_FILTERS_RESET,
  listsQueryParsers,
  toListsListParams,
} from "./lists-query";

export type UseListsQueryResult = {
  clearFilters: () => void;
  hasActiveFilters: boolean;
  listParams: ListsListParams;
  setSearch: (value: string) => void;
  setSort: (value: ListSort) => void;
  setState: ReturnType<typeof useQueryStates<typeof listsQueryParsers>>[1];
  setView: (value: ListViewMode) => void;
  state: ListsQueryState;
  toggleAttention: (value: ListAttentionReason) => void;
};

export function useListsQuery(): UseListsQueryResult {
  const [state, setState] = useQueryStates(listsQueryParsers);

  return {
    clearFilters: () => void setState(LISTS_FILTERS_RESET),
    hasActiveFilters: hasActiveListFilters(state),
    listParams: toListsListParams(state),
    setSearch: (value) => void setState({ q: value === "" ? null : value }),
    setSort: (value) => void setState({ sort: value }),
    setState,
    setView: (value) => void setState({ view: value }),
    state,
    toggleAttention: (value) =>
      void setState({ attention: state.attention === value ? null : value }),
  };
}
