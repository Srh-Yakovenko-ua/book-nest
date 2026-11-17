import type { Nullable } from "@app/shared";

import { addDaysToUtcDay, daysBetweenUtcDays } from "../../../core/iso-date.js";

export type LoanReminderFields = {
  remindBeforeDays: Nullable<number>;
  remindToReturn: boolean;
};

export function extendReturnDate({
  days,
  expectedReturnDate,
  today,
}: {
  days: number;
  expectedReturnDate: Date;
  today: Date;
}): Date {
  const isOverdue = daysBetweenUtcDays({ end: today, start: expectedReturnDate }) > 0;

  return addDaysToUtcDay({ day: isOverdue ? today : expectedReturnDate, days });
}

export function resolveReminderFields({
  expectedReturnDate,
  remindBeforeDays,
}: {
  expectedReturnDate: Nullable<Date>;
  remindBeforeDays: Nullable<number>;
}): LoanReminderFields {
  if (remindBeforeDays === null || expectedReturnDate === null) {
    return { remindBeforeDays: null, remindToReturn: false };
  }

  return { remindBeforeDays, remindToReturn: true };
}
