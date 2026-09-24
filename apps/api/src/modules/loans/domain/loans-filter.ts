import type { LoanFilter, LoansQuery } from "@app/shared";

import { normalizeSearch } from "@app/shared";

import type { LoansFilterInput } from "../infrastructure/loans.repository.js";
import type { LoanDateBounds } from "./loan-ui-status.js";

import { toCreateDate } from "../../../core/iso-date.js";

export const UNRESTRICTED_LOAN_FILTER: LoanFilter = "all";

type LoansFilterQuery = Omit<LoansQuery, "filter" | "pageNumber" | "pageSize" | "sort"> &
  Partial<Pick<LoansQuery, "filter">>;

export function buildLoansFilter({
  bounds,
  query,
  userId,
}: {
  bounds: LoanDateBounds;
  query: LoansFilterQuery;
  userId: string;
}): LoansFilterInput {
  return {
    contactId: query.contactId,
    expectedReturnDateFrom: toCreateDate(query.expectedReturnDateFrom),
    expectedReturnDateTo: toCreateDate(query.expectedReturnDateTo),
    filter: query.filter ?? UNRESTRICTED_LOAN_FILTER,
    hasNote: query.hasNote,
    loanDateFrom: toCreateDate(query.loanDateFrom),
    loanDateTo: toCreateDate(query.loanDateTo),
    reminder: query.reminder,
    search: normalizeSearch(query.search),
    soonEnd: bounds.soonEnd,
    today: bounds.today,
    type: query.type,
    userId,
  };
}
