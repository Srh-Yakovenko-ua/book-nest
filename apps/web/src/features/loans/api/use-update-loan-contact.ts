import type { LoanContactView, UpdateLoanContactInput } from "@app/shared";

import { LoanContactViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { bookChangeEffects } from "@/features/books/api/book-change-effects";
import { loanContactsControllerUpdate } from "@/shared/api/generated/endpoints/loans/loans";

import { loanKeys } from "./loan-keys";

export function useUpdateLoanContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      contactId: string;
      payload: UpdateLoanContactInput;
    }): Promise<LoanContactView> =>
      LoanContactViewSchema.parse(
        await loanContactsControllerUpdate(input.contactId, input.payload),
      ),
    onSuccess: (contact) => {
      queryClient.setQueryData(loanKeys.contacts.detail(contact.id), contact);
      void bookChangeEffects.booksChanged(queryClient, { changes: ["loanChanged"] });
    },
  });
}
