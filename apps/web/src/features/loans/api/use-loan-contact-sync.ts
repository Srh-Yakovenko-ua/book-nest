import type { LoanContactView } from "@app/shared";

import { useQueryClient } from "@tanstack/react-query";

import { bookKeys } from "@/features/books/api/book-keys";
import { seriesKeys } from "@/features/series/api/series-keys";

import { loanKeys, matchesLoans } from "./loan-keys";

export function useLoanContactMutationSync() {
  const queryClient = useQueryClient();

  return (contact: LoanContactView) => {
    queryClient.setQueryData(loanKeys.contacts.detail(contact.id), contact);
    void queryClient.invalidateQueries({ predicate: matchesLoans });
    void queryClient.invalidateQueries({ queryKey: bookKeys.root });
    void queryClient.invalidateQueries({ queryKey: seriesKeys.root });
  };
}
