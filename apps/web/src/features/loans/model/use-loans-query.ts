"use client";

import { useQueryStates } from "nuqs";

import type {
  LoansControllerListFilter,
  LoansControllerListParams,
  LoansControllerListSort,
  LoansControllerListType,
} from "@/shared/api/generated/model";

import type { LoansQueryState } from "./loans-query";

import {
  hasActiveLoanFilters,
  hasActiveLoanSearch,
  LOANS_FILTERS_RESET,
  loansQueryParsers,
  toLoansListParams,
} from "./loans-query";

export type UseLoansQueryResult = {
  clearFilters: () => void;
  filter: LoansControllerListFilter;
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  listParams: LoansControllerListParams;
  setFilter: (value: LoansControllerListFilter) => void;
  setPage: (value: number) => void;
  setSearch: (value: string) => void;
  setSort: (value: LoansControllerListSort) => void;
  setTab: (value: LoansControllerListType) => void;
  sort: LoansControllerListSort;
  state: LoansQueryState;
  tab: LoansControllerListType;
};

export function useLoansQuery(): UseLoansQueryResult {
  const [state, setState] = useQueryStates(loansQueryParsers);

  return {
    clearFilters: () => void setState(LOANS_FILTERS_RESET),
    filter: state.filter,
    hasActiveFilters: hasActiveLoanFilters(state),
    hasActiveSearch: hasActiveLoanSearch(state),
    listParams: toLoansListParams(state),
    setFilter: (value) => void setState({ filter: value, page: null }),
    setPage: (value) => void setState({ page: value }),
    setSearch: (value) => void setState({ page: null, q: value }),
    setSort: (value) => void setState({ page: null, sort: value }),
    setTab: (value) => void setState({ page: null, tab: value }),
    sort: state.sort,
    state,
    tab: state.tab,
  };
}
