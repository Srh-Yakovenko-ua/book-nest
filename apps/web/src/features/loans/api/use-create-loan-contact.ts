import type { CreateLoanContactInput, LoanContactView } from "@app/shared";

import { LoanContactViewSchema } from "@app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { loanContactsControllerCreate } from "@/shared/api/generated/endpoints/loans/loans";

import { loanKeys } from "./loan-keys";

export function useCreateLoanContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateLoanContactInput): Promise<LoanContactView> =>
      LoanContactViewSchema.parse(await loanContactsControllerCreate(input)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: loanKeys.contacts.all });
    },
  });
}
