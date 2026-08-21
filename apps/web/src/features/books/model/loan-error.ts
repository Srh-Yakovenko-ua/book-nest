import { LOAN_CONTACT_ERROR_CODES, LOAN_ERROR_CODES } from "@app/shared";

import { ApiError } from "@/lib/http-client";

export type LoanErrorKey =
  | "activeLoanExists"
  | "bookNotFound"
  | "borrowRequiresFreeBook"
  | "contactArchived"
  | "contactNotFound"
  | "extendRequiresReturnDate"
  | "generic"
  | "lendRequiresOwned"
  | "loanNotFound"
  | "reminderNeedsDate"
  | "returnRequiresLoan";

export function toLoanErrorKey(error: unknown): LoanErrorKey {
  if (!(error instanceof ApiError)) return "generic";

  switch (error.code) {
    case LOAN_CONTACT_ERROR_CODES.archived:
      return "contactArchived";
    case LOAN_CONTACT_ERROR_CODES.notFound:
      return "contactNotFound";
    case LOAN_ERROR_CODES.activeLoanExists:
      return "activeLoanExists";
    case LOAN_ERROR_CODES.bookNotFound:
      return "bookNotFound";
    case LOAN_ERROR_CODES.borrowRequiresFreeBook:
      return "borrowRequiresFreeBook";
    case LOAN_ERROR_CODES.extendRequiresReturnDate:
      return "extendRequiresReturnDate";
    case LOAN_ERROR_CODES.lendRequiresOwned:
      return "lendRequiresOwned";
    case LOAN_ERROR_CODES.loanNotFound:
      return "loanNotFound";
    case LOAN_ERROR_CODES.reminderRequiresReturnDate:
      return "reminderNeedsDate";
    case LOAN_ERROR_CODES.returnRequiresLoan:
      return "returnRequiresLoan";
    default:
      return "generic";
  }
}
