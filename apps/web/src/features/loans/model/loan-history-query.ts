import { type inferParserType, parseAsString, parseAsStringLiteral } from "nuqs/server";

import type {
  LoanHistoryControllerListParams,
  LoanHistoryControllerOverviewParams,
} from "@/shared/api/generated/model";

import {
  LoanHistoryControllerListResult,
  LoanHistoryControllerListSort,
  LoanHistoryControllerListType,
} from "@/shared/api/generated/model";

export const LOAN_HISTORY_PAGE_SIZE = 10;

export const LOAN_HISTORY_RESULT_DEFAULT = LoanHistoryControllerListResult.all;
export const LOAN_HISTORY_SORT_DEFAULT = LoanHistoryControllerListSort.returned_desc;

export const LOAN_HISTORY_RESULT_VALUES = Object.values(LoanHistoryControllerListResult);
export const LOAN_HISTORY_SORT_VALUES = Object.values(LoanHistoryControllerListSort);
export const LOAN_HISTORY_TYPE_VALUES = Object.values(LoanHistoryControllerListType);

export const loanHistoryQueryParsers = {
  from: parseAsString.withDefault(""),
  person: parseAsString.withDefault(""),
  q: parseAsString.withDefault(""),
  result: parseAsStringLiteral(LOAN_HISTORY_RESULT_VALUES).withDefault(LOAN_HISTORY_RESULT_DEFAULT),
  sort: parseAsStringLiteral(LOAN_HISTORY_SORT_VALUES).withDefault(LOAN_HISTORY_SORT_DEFAULT),
  to: parseAsString.withDefault(""),
  type: parseAsStringLiteral(LOAN_HISTORY_TYPE_VALUES),
};

export type LoanHistoryListParams = Omit<LoanHistoryControllerListParams, "pageNumber">;

export type LoanHistoryPeriod = {
  from: string;
  to: string;
};

export type LoanHistoryQueryState = inferParserType<typeof loanHistoryQueryParsers>;

export function hasActiveLoanHistoryFilters(state: LoanHistoryQueryState): boolean {
  return (
    state.result !== LOAN_HISTORY_RESULT_DEFAULT ||
    state.type !== null ||
    state.person.trim() !== "" ||
    state.from !== "" ||
    state.to !== ""
  );
}

export function hasActiveLoanHistorySearch(state: LoanHistoryQueryState): boolean {
  return state.q.trim() !== "";
}

export function toLoanHistoryListParams(state: LoanHistoryQueryState): LoanHistoryListParams {
  const search = state.q.trim();

  return {
    ...toLoanHistoryOverviewParams(state),
    pageSize: LOAN_HISTORY_PAGE_SIZE,
    result: state.result,
    sort: state.sort,
    ...(search === "" ? {} : { search }),
  };
}

export function toLoanHistoryOverviewParams(
  state: LoanHistoryQueryState,
): LoanHistoryControllerOverviewParams {
  const person = state.person.trim();

  return {
    ...(person === "" ? {} : { person }),
    ...(state.from === "" ? {} : { returnedFrom: state.from }),
    ...(state.to === "" ? {} : { returnedTo: state.to }),
    ...(state.type === null ? {} : { type: state.type }),
  };
}

export const LOAN_HISTORY_FILTERS_RESET = {
  from: null,
  person: null,
  q: null,
  result: null,
  to: null,
  type: null,
} satisfies Partial<Record<keyof LoanHistoryQueryState, null>>;
