import {
  type inferParserType,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import type { LoansControllerListParams } from "@/shared/api/generated/model";

import {
  LoansControllerListFilter,
  LoansControllerListSort,
  LoansControllerListType,
} from "@/shared/api/generated/model";

export const LOANS_PAGE_SIZE = 10;

export const LOANS_TAB_DEFAULT = LoansControllerListType.borrowed_from_someone;
export const LOANS_FILTER_DEFAULT = LoansControllerListFilter.all;
export const LOANS_SORT_DEFAULT = LoansControllerListSort.return_date;

export const LOANS_TAB_VALUES = Object.values(LoansControllerListType);
export const LOANS_FILTER_VALUES = Object.values(LoansControllerListFilter);
export const LOANS_SORT_VALUES = Object.values(LoansControllerListSort);

export const loansQueryParsers = {
  filter: parseAsStringLiteral(LOANS_FILTER_VALUES).withDefault(LOANS_FILTER_DEFAULT),
  page: parseAsInteger.withDefault(1),
  q: parseAsString.withDefault(""),
  sort: parseAsStringLiteral(LOANS_SORT_VALUES).withDefault(LOANS_SORT_DEFAULT),
  tab: parseAsStringLiteral(LOANS_TAB_VALUES).withDefault(LOANS_TAB_DEFAULT),
};

export type LoansQueryState = inferParserType<typeof loansQueryParsers>;

export function hasActiveLoanFilters(state: LoansQueryState): boolean {
  return state.filter !== LOANS_FILTER_DEFAULT;
}

export function hasActiveLoanSearch(state: LoansQueryState): boolean {
  return state.q.trim() !== "";
}

export function toLoansListParams(state: LoansQueryState): LoansControllerListParams {
  const search = state.q.trim();

  return {
    filter: state.filter,
    pageNumber: state.page,
    pageSize: LOANS_PAGE_SIZE,
    sort: state.sort,
    type: state.tab,
    ...(search === "" ? {} : { search }),
  };
}

export const LOANS_FILTERS_RESET = {
  filter: null,
  page: null,
  q: null,
} satisfies Partial<Record<keyof LoansQueryState, null>>;
