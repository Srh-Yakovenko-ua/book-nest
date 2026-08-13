import type { LoanHistoryPeopleView } from "@app/shared";

import { LoanHistoryPeopleViewSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { loanHistoryControllerPeople } from "@/shared/api/generated/endpoints/loans/loans";

import { loanKeys } from "./loan-keys";

export function useLoanHistoryPeople() {
  return useQuery({
    queryFn: async (): Promise<LoanHistoryPeopleView> =>
      LoanHistoryPeopleViewSchema.parse(await loanHistoryControllerPeople()),
    queryKey: loanKeys.history.people,
  });
}
