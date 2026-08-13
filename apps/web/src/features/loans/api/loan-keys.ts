import type { QueryKey } from "@tanstack/react-query";

import type { LoansListParams } from "../model/loans-query";

const LOANS_ROOT = "/api/loans";
const LOANS_SUMMARY_ROOT = "/api/loans/summary";
const LOANS_INDEX = [LOANS_ROOT, "list"] as const;

export const loanKeys = {
  list: (params: LoansListParams) => [...LOANS_INDEX, params] as const,
};

export function matchesLoans(query: { queryKey: QueryKey }): boolean {
  const root = query.queryKey[0];
  return root === LOANS_ROOT || root === LOANS_SUMMARY_ROOT;
}
