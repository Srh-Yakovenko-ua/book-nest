import type { Nullable } from "@app/shared";

import { differenceInCalendarDays, format, parseISO } from "date-fns";

const DISPLAY_DATE_FORMAT = "dd.MM.yyyy";
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type LoanRelative =
  | { days: number; kind: "overdue" }
  | { days: number; kind: "soon" }
  | { kind: "none" }
  | { kind: "today" };

export function daysBetweenLoanDates(
  fromIso: Nullable<string>,
  toIso: Nullable<string>,
): Nullable<number> {
  if (fromIso === null || toIso === null) return null;
  if (!ISO_DATE_PATTERN.test(fromIso) || !ISO_DATE_PATTERN.test(toIso)) return null;
  return differenceInCalendarDays(parseISO(toIso), parseISO(fromIso));
}

export function formatLoanDate(iso: null | string): null | string {
  if (iso === null || !ISO_DATE_PATTERN.test(iso)) return null;
  return format(parseISO(iso), DISPLAY_DATE_FORMAT);
}

export function loanRelative(expectedReturnDate: null | string, today: string): LoanRelative {
  if (expectedReturnDate === null || !ISO_DATE_PATTERN.test(expectedReturnDate)) {
    return { kind: "none" };
  }

  const diff = differenceInCalendarDays(parseISO(expectedReturnDate), parseISO(today));
  if (diff < 0) return { days: -diff, kind: "overdue" };
  if (diff === 0) return { kind: "today" };
  return { days: diff, kind: "soon" };
}
