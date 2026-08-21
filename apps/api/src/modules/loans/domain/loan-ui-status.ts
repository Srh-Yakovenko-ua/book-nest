import type { LoanUiStatus, Nullable } from "@app/shared";

import { LOAN_STATS_WINDOWS } from "@app/shared";
import { addDays, differenceInCalendarDays } from "date-fns";

import { startOfUtcDay } from "../../../core/iso-date.js";

const RETURN_SOON_DAYS = LOAN_STATS_WINDOWS.returnSoonDays;

export type LoanDateBounds = {
  soonEnd: Date;
  today: Date;
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

  return { soonEnd: addDays(today, RETURN_SOON_DAYS), today };
}
