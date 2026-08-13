"use client";

import type { LoanType } from "@app/shared";

import { useQueryStates } from "nuqs";

import type {
  LoansControllerListFilter,
  LoansControllerListParams,
  LoansControllerListSort,
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
  person: string;
  setFilter: (value: LoansControllerListFilter) => void;
  setPage: (value: number) => void;
  setPerson: (value: string) => void;
  setSearch: (value: string) => void;
  setSort: (value: LoansControllerListSort) => void;
  sort: LoansControllerListSort;
  state: LoansQueryState;
};

export function useLoansQuery(type: LoanType): UseLoansQueryResult {
  const [state, setState] = useQueryStates(loansQueryParsers);

  return {
    clearFilters: () => void setState(LOANS_FILTERS_RESET),
    filter: state.filter,
    hasActiveFilters: hasActiveLoanFilters(state),
    hasActiveSearch: hasActiveLoanSearch(state),
    listParams: toLoansListParams(state, type),
    person: state.person,
    setFilter: (value) => void setState({ filter: value, page: null }),
    setPage: (value) => void setState({ page: value }),
    setPerson: (value) => void setState({ page: null, person: value === "" ? null : value }),
    setSearch: (value) => void setState({ page: null, q: value }),
    setSort: (value) => void setState({ page: null, sort: value }),
    sort: state.sort,
    state,
  };
}
