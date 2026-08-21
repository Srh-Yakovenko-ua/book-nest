import { type LoanInfoView, LoanTypeSchema, type Nullable } from "@app/shared";

import type { BookLoanModel } from "../../../generated/prisma/models.js";
import type { LoanContactSource } from "./loan-person.js";

import { toNullableIsoDate } from "../../../core/iso-date.js";
import { resolveActiveLoanPerson } from "./loan-person.js";
import { getLoanUiStatus } from "./loan-ui-status.js";

type LoanWithContact = BookLoanModel & { loanContact: LoanContactSource };

export function toLoanInfoView({
  loans,
  today,
}: {
  loans: LoanWithContact[];
  today: Date;
}): Nullable<LoanInfoView> {
  const loan = loans[0] ?? null;
  if (loan === null) {
    return null;
  }

  const person = resolveActiveLoanPerson(loan);

  return {
    contact: person.contact,
    expectedReturnDate: toNullableIsoDate(loan.expectedReturnDate),
    loanContactId: person.loanContactId,
    loanDate: toNullableIsoDate(loan.loanDate),
    loanType: LoanTypeSchema.parse(loan.type),
    loanUiStatus: getLoanUiStatus({ expectedReturnDate: loan.expectedReturnDate, today }),
    note: loan.note,
    personName: person.personName,
    remindBeforeDays: loan.remindBeforeDays,
    remindToReturn: loan.remindToReturn,
  };
}
