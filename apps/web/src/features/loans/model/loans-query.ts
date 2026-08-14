import type { LoanType } from "@app/shared";

import { type inferParserType, parseAsString, parseAsStringLiteral } from "nuqs/server";

import type { LoansControllerListParams } from "@/shared/api/generated/model";

import { LoansControllerListFilter, LoansControllerListSort } from "@/shared/api/generated/model";

import { parseAsContactId } from "./contact-id-param";

export const LOANS_PAGE_SIZE = 10;

export const LOANS_FILTER_DEFAULT = LoansControllerListFilter.all;
export const LOANS_SORT_DEFAULT = LoansControllerListSort.overdue_first;

export const LOANS_FILTER_VALUES = Object.values(LoansControllerListFilter);
export const LOANS_SORT_VALUES = Object.values(LoansControllerListSort);

export const loansQueryParsers = {
  contactId: parseAsContactId,
  filter: parseAsStringLiteral(LOANS_FILTER_VALUES).withDefault(LOANS_FILTER_DEFAULT),
  q: parseAsString.withDefault(""),
  sort: parseAsStringLiteral(LOANS_SORT_VALUES).withDefault(LOANS_SORT_DEFAULT),
};

export type LoansListParams = Omit<LoansControllerListParams, "pageNumber">;

export type LoansQueryState = inferParserType<typeof loansQueryParsers>;

export function hasActiveLoanFilters(state: LoansQueryState): boolean {
  return state.filter !== LOANS_FILTER_DEFAULT || state.contactId !== "";
}

export function hasActiveLoanSearch(state: LoansQueryState): boolean {
  return state.q.trim() !== "";
}

export function toLoansListParams(state: LoansQueryState, type: LoanType): LoansListParams {
  const search = state.q.trim();

  return {
    filter: state.filter,
    pageSize: LOANS_PAGE_SIZE,
    sort: state.sort,
    type,
    ...(state.contactId === "" ? {} : { contactId: state.contactId }),
    ...(search === "" ? {} : { search }),
  };
}

export const LOANS_FILTERS_RESET = {
  contactId: null,
  filter: null,
  q: null,
} satisfies Partial<Record<keyof LoansQueryState, null>>;
