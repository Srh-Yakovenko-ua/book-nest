import type { Nullable } from "@app/shared";

import {
  addDaysToIsoDate,
  daysBetweenIsoDates,
  parseIsoDate,
  toIsoDate,
} from "../../../core/iso-date.js";

export type LoanReminderFields = {
  remindBeforeDays: Nullable<number>;
  remindToReturn: boolean;
};

export function extendReturnDate({
  days,
  expectedReturnDate,
  now,
}: {
  days: number;
  expectedReturnDate: Date;
  now: Date;
}): Date {
  const todayIsoDate = toIsoDate(now);
  const returnIsoDate = toIsoDate(expectedReturnDate);
  const isOverdue =
    daysBetweenIsoDates({ endIsoDate: todayIsoDate, startIsoDate: returnIsoDate }) > 0;

  return parseIsoDate(addDaysToIsoDate(isOverdue ? todayIsoDate : returnIsoDate, days));
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
