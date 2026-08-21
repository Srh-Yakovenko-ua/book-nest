import type { LoanContactView } from "@app/shared";

import { LoanContactViewSchema } from "@app/shared";
import { useMutation } from "@tanstack/react-query";

import { loanContactsControllerArchive } from "@/shared/api/generated/endpoints/loans/loans";

import { useLoanContactMutationSync } from "./use-loan-contact-sync";

export function useArchiveLoanContact() {
  const syncContact = useLoanContactMutationSync();

  return useMutation({
    mutationFn: async (contactId: string): Promise<LoanContactView> =>
      LoanContactViewSchema.parse(await loanContactsControllerArchive(contactId)),
    onSuccess: syncContact,
  });
}
