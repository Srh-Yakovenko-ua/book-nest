import type { Nullable } from "@app/shared";

import { differenceInCalendarDays, parseISO } from "date-fns";

import { formatDate } from "@/lib/format";
import { ISO_DAY } from "@/lib/iso-day";

export type LoanRelative =
  | { days: number; kind: "overdue" }
  | { days: number; kind: "soon" }
  | { kind: "none" }
  | { kind: "today" };

export type LoanTerm =
  | { days: number; kind: "inDays" }
  | { days: number; kind: "overdue" }
  | { kind: "none" }
  | { kind: "today" }
  | { kind: "tomorrow" };

export function daysBetweenLoanDates(
  fromIso: Nullable<string>,
  toIso: Nullable<string>,
): Nullable<number> {
  if (fromIso === null || toIso === null) return null;
  if (!ISO_DAY.pattern.test(fromIso) || !ISO_DAY.pattern.test(toIso)) return null;
  return differenceInCalendarDays(parseISO(toIso), parseISO(fromIso));
}

export function formatLoanDate({
  iso,
  locale,
}: {
  iso: Nullable<string>;
  locale: string;
}): Nullable<string> {
  if (iso === null || !ISO_DAY.pattern.test(iso)) return null;
  return formatDate(iso, locale);
}

export function loanRelative(expectedReturnDate: null | string, today: string): LoanRelative {
  if (expectedReturnDate === null || !ISO_DAY.pattern.test(expectedReturnDate)) {
    return { kind: "none" };
  }

  const diff = differenceInCalendarDays(parseISO(expectedReturnDate), parseISO(today));
  if (diff < 0) return { days: -diff, kind: "overdue" };
  if (diff === 0) return { kind: "today" };
  return { days: diff, kind: "soon" };
}

export function loanTerm(expectedReturnDate: null | string, today: string): LoanTerm {
  const relative = loanRelative(expectedReturnDate, today);

  if (relative.kind === "none") return { kind: "none" };
  if (relative.kind === "today") return { kind: "today" };
  if (relative.kind === "overdue") return { days: relative.days, kind: "overdue" };
  if (relative.days === 1) return { kind: "tomorrow" };
  return { days: relative.days, kind: "inDays" };
}
