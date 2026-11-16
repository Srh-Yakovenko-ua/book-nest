import type { LoanHistoryResult, Nullable } from "@app/shared";

import { isAfter, parseISO } from "date-fns";

import { daysBetweenIsoDates, toNullableIsoDate, toZonedIsoDate } from "../../../core/iso-date.js";

export type CompletedLoanDates = {
  expectedReturnDate: Nullable<Date>;
  loanDate: Nullable<Date>;
  returnedAt: Date;
  timeZone: string;
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
  timeZone,
}: CompletedLoanDates): LoanHistoryOutcome {
  const loanIsoDate = toNullableIsoDate(loanDate);
  const returnedDate = returnedDateNotBeforeLoanDate({
    loanIsoDate,
    readerReturnedDate: toZonedIsoDate({ instant: returnedAt, timeZone }),
  });
  const daysAfterExpectedReturn = daysAfterExpectedReturnDate({ expectedReturnDate, returnedDate });

  return {
    delayDays:
      daysAfterExpectedReturn !== null && daysAfterExpectedReturn > 0
        ? daysAfterExpectedReturn
        : null,
    durationDays: durationDaysFrom({ loanIsoDate, returnedDate }),
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
  loanIsoDate,
  returnedDate,
}: {
  loanIsoDate: Nullable<string>;
  returnedDate: string;
}): Nullable<number> {
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

function returnedDateNotBeforeLoanDate({
  loanIsoDate,
  readerReturnedDate,
}: {
  loanIsoDate: Nullable<string>;
  readerReturnedDate: string;
}): string {
  if (loanIsoDate === null) {
    return readerReturnedDate;
  }
  return isAfter(parseISO(loanIsoDate), parseISO(readerReturnedDate))
    ? loanIsoDate
    : readerReturnedDate;
}
