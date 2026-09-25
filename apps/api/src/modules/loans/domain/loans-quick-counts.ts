import type { LoansQuickCounts } from "@app/shared";

import type { LoansFilterInput } from "../infrastructure/loans.repository.js";

import { UNRESTRICTED_LOAN_FILTER } from "./loans-filter.js";

export type LoansQuickCountFilters = Record<LoansQuickFilterKey, LoansFilterInput>;

type LoansQuickCountsConfig = {
  readonly overlays: Readonly<Record<LoansQuickFilterKey, LoansQuickFilterOverlay>>;
};

type LoansQuickFilterKey = keyof LoansQuickCounts;

type LoansQuickFilterOverlay = Pick<LoansFilterInput, "filter">;

export const LOANS_QUICK_COUNTS: LoansQuickCountsConfig = {
  overlays: {
    all: { filter: "all" },
    no_return_date: { filter: "no_return_date" },
    overdue: { filter: "overdue" },
    return_soon: { filter: "return_soon" },
  },
};

export function buildLoansQuickCountFilters(filter: LoansFilterInput): LoansQuickCountFilters {
  const base = clearLoansQuickFilterAxis(filter);
  const { overlays } = LOANS_QUICK_COUNTS;
  return {
    all: { ...base, ...overlays.all },
    no_return_date: { ...base, ...overlays.no_return_date },
    overdue: { ...base, ...overlays.overdue },
    return_soon: { ...base, ...overlays.return_soon },
  };
}

export function clearLoansQuickFilterAxis(filter: LoansFilterInput): LoansFilterInput {
  return { ...filter, filter: UNRESTRICTED_LOAN_FILTER };
}
