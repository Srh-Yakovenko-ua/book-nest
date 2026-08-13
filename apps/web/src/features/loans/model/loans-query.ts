import type { LoanType } from "@app/shared";

import {
  type inferParserType,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import type { LoansControllerListParams } from "@/shared/api/generated/model";

import { LoansControllerListFilter, LoansControllerListSort } from "@/shared/api/generated/model";

export const LOANS_PAGE_SIZE = 10;

export const LOANS_FILTER_DEFAULT = LoansControllerListFilter.all;
export const LOANS_SORT_DEFAULT = LoansControllerListSort.return_date;

export const LOANS_FILTER_VALUES = Object.values(LoansControllerListFilter);
export const LOANS_SORT_VALUES = Object.values(LoansControllerListSort);

export const loansQueryParsers = {
  filter: parseAsStringLiteral(LOANS_FILTER_VALUES).withDefault(LOANS_FILTER_DEFAULT),
  page: parseAsInteger.withDefault(1),
  person: parseAsString.withDefault(""),
  q: parseAsString.withDefault(""),
  sort: parseAsStringLiteral(LOANS_SORT_VALUES).withDefault(LOANS_SORT_DEFAULT),
};

export type LoansQueryState = inferParserType<typeof loansQueryParsers>;

export function hasActiveLoanFilters(state: LoansQueryState): boolean {
  return state.filter !== LOANS_FILTER_DEFAULT || state.person.trim() !== "";
}

export function hasActiveLoanSearch(state: LoansQueryState): boolean {
  return state.q.trim() !== "";
}

export function toLoansListParams(
  state: LoansQueryState,
  type: LoanType,
): LoansControllerListParams {
  const search = state.q.trim();
  const person = state.person.trim();

  return {
    filter: state.filter,
    pageNumber: state.page,
    pageSize: LOANS_PAGE_SIZE,
    sort: state.sort,
    type,
    ...(person === "" ? {} : { person }),
    ...(search === "" ? {} : { search }),
  };
}

export const LOANS_FILTERS_RESET = {
  filter: null,
  page: null,
  person: null,
  q: null,
} satisfies Partial<Record<keyof LoansQueryState, null>>;
