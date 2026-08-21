import type { LoanContactView } from "@app/shared";

import { LoanContactsViewSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { loanContactsControllerList } from "@/shared/api/generated/endpoints/loans/loans";
import { LoanContactsControllerListStatus } from "@/shared/api/generated/model";

import { loanKeys } from "./loan-keys";

const LOAN_CONTACTS_SEARCH_PAGE_SIZE = 20;

export function useLoanContacts(search: string) {
  const trimmed = search.trim();

  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<LoanContactView[]> => {
      const response = await loanContactsControllerList({
        pageSize: LOAN_CONTACTS_SEARCH_PAGE_SIZE,
        search: trimmed.length > 0 ? trimmed : undefined,
        status: LoanContactsControllerListStatus.active,
      });
      return LoanContactsViewSchema.parse(response).items;
    },
    queryKey: loanKeys.contacts.search(trimmed),
  });
}
