import type { LoansQuickCounts } from "@app/shared";

import { LoansQuickCountsSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { LoansControllerQuickCountsParams } from "@/shared/api/generated/model";

import { loansControllerQuickCounts } from "@/shared/api/generated/endpoints/loans/loans";

import { loanKeys } from "./loan-keys";

export function useLoansQuickCounts(params: LoansControllerQuickCountsParams) {
  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<LoansQuickCounts> =>
      LoansQuickCountsSchema.parse(await loansControllerQuickCounts(params, { signal })),
    queryKey: loanKeys.quickCounts(params),
  });
}
