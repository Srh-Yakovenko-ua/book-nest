import type { LoanContactView, Nullable } from "@app/shared";

import { LoanContactViewSchema } from "@app/shared";

import { HTTP_STATUS, isApiErrorStatus } from "@/lib/api-errors";
import { loanContactsControllerDetailByName } from "@/shared/api/generated/endpoints/loans/loans";

export async function findLoanContactByName(name: string): Promise<Nullable<LoanContactView>> {
  try {
    return LoanContactViewSchema.parse(await loanContactsControllerDetailByName({ name }));
  } catch (error) {
    if (isApiErrorStatus(error, HTTP_STATUS.notFound)) return null;
    throw error;
  }
}
