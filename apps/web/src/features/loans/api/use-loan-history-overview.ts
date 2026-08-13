import type { LoanHistoryOverviewView } from "@app/shared";

import { LoanHistoryOverviewViewSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { LoanHistoryControllerOverviewParams } from "@/shared/api/generated/model";

import { loanHistoryControllerOverview } from "@/shared/api/generated/endpoints/loans/loans";

import { loanKeys } from "./loan-keys";

export function useLoanHistoryOverview(params: LoanHistoryControllerOverviewParams) {
  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<LoanHistoryOverviewView> =>
      LoanHistoryOverviewViewSchema.parse(await loanHistoryControllerOverview(params)),
    queryKey: loanKeys.history.overview(params),
  });
}
