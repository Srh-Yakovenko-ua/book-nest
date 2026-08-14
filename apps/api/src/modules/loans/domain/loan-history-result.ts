import type { LoanHistoryResult, Nullable } from "@app/shared";

import { daysBetweenIsoDates, toIsoDate, toNullableIsoDate } from "../../../core/iso-date.js";

export type CompletedLoanDates = {
  expectedReturnDate: Nullable<Date>;
  loanDate: Nullable<Date>;
  returnedAt: Date;
};

export type LoanHistoryOutcome = {
  delayDays: Nullable<number>;
  durationDays: Nullable<number>;
  historyResult: LoanHistoryResult;
  returnedDate: string;
};

export function deriveLoanHistoryOutcome({
  expectedReturnDate,
  loanDate,
  returnedAt,
}: CompletedLoanDates): LoanHistoryOutcome {
  const returnedDate = toIsoDate(returnedAt);
  const daysAfterExpectedReturn = daysAfterExpectedReturnDate({ expectedReturnDate, returnedDate });

  return {
    delayDays:
      daysAfterExpectedReturn !== null && daysAfterExpectedReturn > 0
        ? daysAfterExpectedReturn
        : null,
    durationDays: durationDaysFrom({ loanDate, returnedDate }),
    historyResult: historyResultFrom(daysAfterExpectedReturn),
    returnedDate,
  };
}

function daysAfterExpectedReturnDate({
  expectedReturnDate,
  returnedDate,
}: {
  expectedReturnDate: Nullable<Date>;
  returnedDate: string;
}): Nullable<number> {
  const expectedIsoDate = toNullableIsoDate(expectedReturnDate);
  return expectedIsoDate === null
    ? null
    : daysBetweenIsoDates({ endIsoDate: returnedDate, startIsoDate: expectedIsoDate });
}

function durationDaysFrom({
  loanDate,
  returnedDate,
}: {
  loanDate: Nullable<Date>;
  returnedDate: string;
}): Nullable<number> {
  const loanIsoDate = toNullableIsoDate(loanDate);
  return loanIsoDate === null
    ? null
    : daysBetweenIsoDates({ endIsoDate: returnedDate, startIsoDate: loanIsoDate });
}

function historyResultFrom(daysAfterExpectedReturn: Nullable<number>): LoanHistoryResult {
  if (daysAfterExpectedReturn === null) {
    return "no_due_date";
  }
  return daysAfterExpectedReturn > 0 ? "late" : "on_time";
}
