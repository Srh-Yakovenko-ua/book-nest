import { PaginatedLoanHistorySchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";

import { loanHistoryControllerList } from "@/shared/api/generated/endpoints/loans/loans";

import type { LoanHistoryListParams } from "../model/loan-history-query";

import { loanKeys } from "./loan-keys";

export type LoanHistoryPage = z.infer<typeof PaginatedLoanHistorySchema>;

export function useLoanHistory(params: LoanHistoryListParams) {
  return useInfiniteQuery({
    getNextPageParam: (lastPage: LoanHistoryPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }): Promise<LoanHistoryPage> => {
      const response = await loanHistoryControllerList({ ...params, pageNumber: pageParam });
      return PaginatedLoanHistorySchema.parse(response);
    },
    queryKey: loanKeys.history.list(params),
  });
}
