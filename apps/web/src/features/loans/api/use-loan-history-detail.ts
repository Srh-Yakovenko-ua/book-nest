import type { LoanHistoryDetailView, Nullable } from "@app/shared";

import { LoanHistoryDetailViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { loanHistoryControllerDetail } from "@/shared/api/generated/endpoints/loans/loans";

import { loanKeys } from "./loan-keys";

export function useLoanHistoryDetail(loanId: Nullable<string>) {
  return useQuery({
    enabled: loanId !== null,
    queryFn: async (): Promise<LoanHistoryDetailView> =>
      LoanHistoryDetailViewSchema.parse(await loanHistoryControllerDetail(loanId ?? "")),
    queryKey: loanKeys.history.detail(loanId ?? ""),
    retry: false,
  });
}
