import type { LoanContactView, UpdateLoanContactInput } from "@app/shared";

import { LoanContactViewSchema } from "@app/shared";
import { useMutation } from "@tanstack/react-query";

import { loanContactsControllerUpdate } from "@/shared/api/generated/endpoints/loans/loans";

import { useLoanContactMutationSync } from "./use-loan-contact-sync";

export function useUpdateLoanContact() {
  const syncContact = useLoanContactMutationSync();

  return useMutation({
    mutationFn: async (input: {
      contactId: string;
      payload: UpdateLoanContactInput;
    }): Promise<LoanContactView> =>
      LoanContactViewSchema.parse(
        await loanContactsControllerUpdate(input.contactId, input.payload),
      ),
    onSuccess: syncContact,
  });
}
