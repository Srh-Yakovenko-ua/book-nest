import type { LoanContactView, UpdateLoanContactInput } from "@app/shared";

import { LoanContactViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { bookKeys } from "@/features/books/api/book-keys";
import { seriesKeys } from "@/features/series/api/series-keys";
import { loanContactsControllerUpdate } from "@/shared/api/generated/endpoints/loans/loans";

import { useLoanContactMutationSync } from "./use-loan-contact-sync";

export function useUpdateLoanContact() {
  const queryClient = useQueryClient();
  const syncContact = useLoanContactMutationSync();

  return useMutation({
    mutationFn: async (input: {
      contactId: string;
      payload: UpdateLoanContactInput;
    }): Promise<LoanContactView> =>
      LoanContactViewSchema.parse(
        await loanContactsControllerUpdate(input.contactId, input.payload),
      ),
    onSuccess: (contact) => {
      syncContact(contact);
      void queryClient.invalidateQueries({ queryKey: bookKeys.root });
      void queryClient.invalidateQueries({ queryKey: seriesKeys.root });
    },
  });
}
