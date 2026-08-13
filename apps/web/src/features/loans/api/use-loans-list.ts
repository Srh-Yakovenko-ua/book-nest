import { PaginatedLoansSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";

import { loansControllerList } from "@/shared/api/generated/endpoints/loans/loans";

import type { LoansListParams } from "../model/loans-query";

import { loanKeys } from "./loan-keys";

export type LoansPage = z.infer<typeof PaginatedLoansSchema>;

export function useLoansList(params: LoansListParams) {
  return useInfiniteQuery({
    getNextPageParam: (lastPage: LoansPage) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }): Promise<LoansPage> => {
      const response = await loansControllerList({ ...params, pageNumber: pageParam });
      return PaginatedLoansSchema.parse(response);
    },
    queryKey: loanKeys.list(params),
  });
}
