import type { LoanContactView } from "@app/shared";

import { LoanContactsViewSchema } from "@app/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { loanContactsControllerList } from "@/shared/api/generated/endpoints/loans/loans";

import { loanKeys } from "./loan-keys";

const LOAN_CONTACTS_SEARCH_LIMIT = 20;

export function useLoanContacts(search: string) {
  const trimmed = search.trim();

  return useQuery({
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<LoanContactView[]> => {
      const response = await loanContactsControllerList({
        limit: LOAN_CONTACTS_SEARCH_LIMIT,
        search: trimmed.length > 0 ? trimmed : undefined,
      });
      return LoanContactsViewSchema.parse(response).items;
    },
    queryKey: loanKeys.contacts.search(trimmed),
  });
}
