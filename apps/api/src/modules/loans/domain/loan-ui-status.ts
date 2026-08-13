import type { LoanUiStatus, Nullable } from "@app/shared";

import { LOAN_STATS_WINDOWS } from "@app/shared";
import { addDays, differenceInCalendarDays } from "date-fns";

import { startOfUtcDay } from "../../../core/iso-date.js";

const RETURN_SOON_DAYS = LOAN_STATS_WINDOWS.returnSoonDays;
const DAYS_FROM_MONDAY_TO_SUNDAY = 6;

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
  expectedReturnDate: Nullable<Date>;
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
  const today = startOfUtcDay(now);
  const soonEnd = addDays(today, RETURN_SOON_DAYS);
  const mondayOffset = (today.getUTCDay() + 6) % 7;
  const weekStart = addDays(today, -mondayOffset);
  const weekEnd = addDays(weekStart, DAYS_FROM_MONDAY_TO_SUNDAY);

  return { soonEnd, today, weekEnd, weekStart };
}
