"use client";

import type { LoanType } from "@app/shared";

import { useQueryStates } from "nuqs";

import type {
  LoansControllerListFilter,
  LoansControllerListSort,
} from "@/shared/api/generated/model";

import type { LoansListParams, LoansQueryState } from "./loans-query";

import {
  hasActiveLoanFilters,
  hasActiveLoanSearch,
  LOANS_FILTERS_RESET,
  loansQueryParsers,
  toLoansListParams,
} from "./loans-query";

export type UseLoansQueryResult = {
  clearFilters: () => void;
  contactId: string;
  filter: LoansControllerListFilter;
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  listParams: LoansListParams;
  setContactId: (value: string) => void;
  setFilter: (value: LoansControllerListFilter) => void;
  setSearch: (value: string) => void;
  setSort: (value: LoansControllerListSort) => void;
  sort: LoansControllerListSort;
  state: LoansQueryState;
};

export function useLoansQuery(type: LoanType): UseLoansQueryResult {
  const [state, setState] = useQueryStates(loansQueryParsers);

  return {
    clearFilters: () => void setState(LOANS_FILTERS_RESET),
    contactId: state.contactId,
    filter: state.filter,
    hasActiveFilters: hasActiveLoanFilters(state),
    hasActiveSearch: hasActiveLoanSearch(state),
    listParams: toLoansListParams(state, type),
    setContactId: (value) => void setState({ contactId: value === "" ? null : value }),
    setFilter: (value) => void setState({ filter: value }),
    setSearch: (value) => void setState({ q: value }),
    setSort: (value) => void setState({ sort: value }),
    sort: state.sort,
    state,
  };
}
