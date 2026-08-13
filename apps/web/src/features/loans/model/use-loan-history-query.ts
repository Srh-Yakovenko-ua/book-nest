"use client";

import type { Nullable } from "@app/shared";

import { useQueryStates } from "nuqs";

import type {
  LoanHistoryControllerListResult,
  LoanHistoryControllerListSort,
  LoanHistoryControllerListType,
  LoanHistoryControllerOverviewParams,
} from "@/shared/api/generated/model";

import type {
  LoanHistoryListParams,
  LoanHistoryPeriod,
  LoanHistoryQueryState,
} from "./loan-history-query";

import {
  hasActiveLoanHistoryFilters,
  hasActiveLoanHistorySearch,
  LOAN_HISTORY_FILTERS_RESET,
  loanHistoryQueryParsers,
  toLoanHistoryListParams,
  toLoanHistoryOverviewParams,
} from "./loan-history-query";

export type UseLoanHistoryQueryResult = {
  clearFilters: () => void;
  hasActiveFilters: boolean;
  hasActiveSearch: boolean;
  listParams: LoanHistoryListParams;
  overviewParams: LoanHistoryControllerOverviewParams;
  period: LoanHistoryPeriod;
  person: string;
  result: LoanHistoryControllerListResult;
  setPeriod: (period: LoanHistoryPeriod) => void;
  setPerson: (value: string) => void;
  setResult: (value: LoanHistoryControllerListResult) => void;
  setSearch: (value: string) => void;
  setSort: (value: LoanHistoryControllerListSort) => void;
  setType: (value: Nullable<LoanHistoryControllerListType>) => void;
  sort: LoanHistoryControllerListSort;
  state: LoanHistoryQueryState;
  type: Nullable<LoanHistoryControllerListType>;
};

export function useLoanHistoryQuery(): UseLoanHistoryQueryResult {
  const [state, setState] = useQueryStates(loanHistoryQueryParsers);

  return {
    clearFilters: () => void setState(LOAN_HISTORY_FILTERS_RESET),
    hasActiveFilters: hasActiveLoanHistoryFilters(state),
    hasActiveSearch: hasActiveLoanHistorySearch(state),
    listParams: toLoanHistoryListParams(state),
    overviewParams: toLoanHistoryOverviewParams(state),
    period: { from: state.from, to: state.to },
    person: state.person,
    result: state.result,
    setPeriod: ({ from, to }) =>
      void setState({ from: from === "" ? null : from, to: to === "" ? null : to }),
    setPerson: (value) => void setState({ person: value === "" ? null : value }),
    setResult: (value) => void setState({ result: value }),
    setSearch: (value) => void setState({ q: value }),
    setSort: (value) => void setState({ sort: value }),
    setType: (value) => void setState({ type: value }),
    sort: state.sort,
    state,
    type: state.type,
  };
}
