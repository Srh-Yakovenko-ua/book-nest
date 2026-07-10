import type { QueryKey } from "@tanstack/react-query";

const LOANS_ROOT = "/api/loans";
const LOANS_SUMMARY_ROOT = "/api/loans/summary";

export function matchesLoans(query: { queryKey: QueryKey }): boolean {
  const root = query.queryKey[0];
  return root === LOANS_ROOT || root === LOANS_SUMMARY_ROOT;
}
