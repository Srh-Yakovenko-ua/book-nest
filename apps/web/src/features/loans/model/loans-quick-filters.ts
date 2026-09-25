import type { LoansQuickCounts } from "@app/shared";

import type {
  LoansControllerListFilter,
  LoansControllerQuickCountsParams,
} from "@/shared/api/generated/model";

import type { LoansListParams } from "./loans-query";

export const LOANS_QUICK_FILTER_KEYS = [
  "all",
  "overdue",
  "return_soon",
  "no_return_date",
] as const satisfies readonly (keyof LoansQuickCounts & LoansControllerListFilter)[];

export type LoansQuickFilterKey = (typeof LOANS_QUICK_FILTER_KEYS)[number];

export function toLoansQuickCountsParams(
  listParams: LoansListParams,
): LoansControllerQuickCountsParams {
  const { filter: _filter, pageSize: _pageSize, sort: _sort, ...countFilters } = listParams;
  return countFilters;
}
