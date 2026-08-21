import type { LoanContactsView } from "@app/shared";

import { LoanContactsViewSchema } from "@app/shared";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { loanContactsControllerList } from "@/shared/api/generated/endpoints/loans/loans";

import type { LoanContactsListParams } from "../model/loan-contacts-query";

import { loanKeys } from "./loan-keys";

export function useLoanContactsList(params: LoanContactsListParams) {
  return useInfiniteQuery({
    getNextPageParam: (lastPage: LoanContactsView) =>
      lastPage.page < lastPage.pagesCount ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }): Promise<LoanContactsView> => {
      const response = await loanContactsControllerList({ ...params, pageNumber: pageParam });
      return LoanContactsViewSchema.parse(response);
    },
    queryKey: loanKeys.contacts.list(params),
  });
}
