import type { LoanUiStatus } from "@app/shared";

import { addDays, differenceInCalendarDays } from "date-fns";

import { parseIsoDate, toIsoDate } from "../../../core/iso-date.js";

const RETURN_SOON_DAYS = 7;
const DAYS_IN_WEEK = 6;

export type LoanDateBounds = {
  soonEnd: Date;
  today: Date;
  weekEnd: Date;
  weekStart: Date;
};

export function getLoanUiStatus({
  expectedReturnDate,
  today,
}: {
  expectedReturnDate: Date | null;
  today: Date;
}): LoanUiStatus {
  if (expectedReturnDate === null) {
    return "no_return_date";
  }

  const daysUntilReturn = differenceInCalendarDays(expectedReturnDate, today);
  if (daysUntilReturn < 0) {
    return "overdue";
  }
  if (daysUntilReturn <= RETURN_SOON_DAYS) {
    return "return_soon";
  }
  return "on_time";
}

export function loanDateBounds(now: Date): LoanDateBounds {
  const today = parseIsoDate(toIsoDate(now));
  const soonEnd = addDays(today, RETURN_SOON_DAYS);
  const mondayOffset = (today.getUTCDay() + 6) % 7;
  const weekStart = addDays(today, -mondayOffset);
  const weekEnd = addDays(weekStart, DAYS_IN_WEEK);

  return { soonEnd, today, weekEnd, weekStart };
}
