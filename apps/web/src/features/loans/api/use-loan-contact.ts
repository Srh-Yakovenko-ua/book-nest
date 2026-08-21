import type { LoanContactView, Nullable } from "@app/shared";

import { LoanContactViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { loanContactsControllerDetail } from "@/shared/api/generated/endpoints/loans/loans";

import { loanKeys } from "./loan-keys";

export function useLoanContact(contactId: Nullable<string>) {
  return useQuery({
    enabled: contactId !== null,
    queryFn: async (): Promise<LoanContactView> =>
      LoanContactViewSchema.parse(await loanContactsControllerDetail(contactId ?? "")),
    queryKey: loanKeys.contacts.detail(contactId ?? ""),
    retry: false,
  });
}
