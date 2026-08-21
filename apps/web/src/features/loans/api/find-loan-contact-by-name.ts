import type { LoanContactView, Nullable } from "@app/shared";

import { LoanContactViewSchema } from "@app/shared";

import { ApiError } from "@/lib/http-client";
import { loanContactsControllerDetailByName } from "@/shared/api/generated/endpoints/loans/loans";

const NOT_FOUND_STATUS = 404;

export async function findLoanContactByName(name: string): Promise<Nullable<LoanContactView>> {
  try {
    return LoanContactViewSchema.parse(await loanContactsControllerDetailByName({ name }));
  } catch (error) {
    if (error instanceof ApiError && error.status === NOT_FOUND_STATUS) return null;
    throw error;
  }
}
