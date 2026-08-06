import { type LoanInfoView, LoanTypeSchema, type Nullable } from "@app/shared";

import type { BookLoanModel } from "../../../generated/prisma/models.js";

import { toNullableIsoDate } from "../../../core/iso-date.js";
import { getLoanUiStatus } from "./loan-ui-status.js";

export function toLoanInfoView({
  loans,
  today,
}: {
  loans: BookLoanModel[];
  today: Date;
}): Nullable<LoanInfoView> {
  const loan = loans[0] ?? null;
  if (loan === null) {
    return null;
  }

  return {
    contact: loan.contact,
    expectedReturnDate: toNullableIsoDate(loan.expectedReturnDate),
    loanDate: toNullableIsoDate(loan.loanDate),
    loanType: LoanTypeSchema.parse(loan.type),
    loanUiStatus: getLoanUiStatus({ expectedReturnDate: loan.expectedReturnDate, today }),
    note: loan.note,
    personName: loan.personName,
    remindToReturn: loan.remindToReturn,
  };
}
