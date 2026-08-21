import type { LoanContactView } from "@app/shared";

import { useQueryClient } from "@tanstack/react-query";

import { loanKeys, matchesLoans } from "./loan-keys";

export function useLoanContactMutationSync() {
  const queryClient = useQueryClient();

  return (contact: LoanContactView) => {
    queryClient.setQueryData(loanKeys.contacts.detail(contact.id), contact);
    void queryClient.invalidateQueries({ predicate: matchesLoans });
  };
}
