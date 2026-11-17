import type { LoansSummaryView } from "@app/shared";

import { LoansSummaryViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { loansControllerSummary } from "@/shared/api/generated/endpoints/loans/loans";

import { loanKeys } from "./loan-keys";

export function useLoansSummary() {
  return useQuery({
    queryFn: async ({ signal }): Promise<LoansSummaryView> =>
      LoansSummaryViewSchema.parse(await loansControllerSummary({ signal })),
    queryKey: loanKeys.summary,
  });
}
