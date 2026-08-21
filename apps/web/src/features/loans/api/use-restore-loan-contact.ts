import type { LoanContactView } from "@app/shared";

import { LoanContactViewSchema } from "@app/shared";
import { useMutation } from "@tanstack/react-query";

import { loanContactsControllerRestore } from "@/shared/api/generated/endpoints/loans/loans";

import { useLoanContactMutationSync } from "./use-loan-contact-sync";

export function useRestoreLoanContact() {
  const syncContact = useLoanContactMutationSync();

  return useMutation({
    mutationFn: async (contactId: string): Promise<LoanContactView> =>
      LoanContactViewSchema.parse(await loanContactsControllerRestore(contactId)),
    onSuccess: syncContact,
  });
}
