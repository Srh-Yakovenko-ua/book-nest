import type { LoanDirectionSummary, ValueOf } from "@app/shared";

import type { LoansControllerListFilter } from "@/shared/api/generated/model";

import type { LoanDirection } from "./loan-pages";

export const LOANS_QUICK_FILTER_KEYS = {
  borrowed: ["all", "overdue", "return_soon", "no_return_date"],
  lent: ["all", "overdue", "return_soon", "no_return_date", "without_reminder"],
} as const satisfies Record<LoanDirection, readonly LoansControllerListFilter[]>;

export type LoansQuickFilterCounts = Record<LoansQuickFilterKey, number>;

export type LoansQuickFilterKey = ValueOf<typeof LOANS_QUICK_FILTER_KEYS>[number];

export function loansQuickFilterCounts(summary: LoanDirectionSummary): LoansQuickFilterCounts {
  return {
    all: summary.totalCount,
    no_return_date: summary.noReturnDateCount,
    overdue: summary.overdueCount,
    return_soon: summary.returningSoonCount,
    without_reminder: summary.noReminderWithDateCount,
  };
}
