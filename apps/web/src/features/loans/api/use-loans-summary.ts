import { LoansSummaryViewSchema } from "@app/shared";

import { useLoansControllerSummary } from "@/shared/api/generated/endpoints/loans/loans";

export function useLoansSummary() {
  return useLoansControllerSummary({
    query: {
      select: (data) => LoansSummaryViewSchema.parse(data),
    },
  });
}
