import type {
  Nullable,
  ReadingStatisticsCalendarSection,
  ReadingStatisticsMeta,
  StatisticsCalendarDay,
  UserView,
} from "@app/shared";

import { addDays, isAfter, isBefore, isValid, parseISO } from "date-fns";

import { parseIsoDay } from "@/lib/format";
import { instantToIsoDay } from "@/lib/iso-day";

const ACCOUNT_HISTORY = { reliableFromToleranceDays: 1 } as const;

type AccountUser = Nullable<Pick<UserView, "createdAt">>;

export function accountCreatedDay({
  timeZone,
  user,
}: {
  timeZone: string;
  user: AccountUser;
}): Nullable<string> {
  if (user === null) return null;
  if (!isValid(parseISO(user.createdAt))) return null;
  return instantToIsoDay({ instant: user.createdAt, timeZone });
}

export function isBeforeAccountStart({
  accountStart,
  date,
}: {
  accountStart: Nullable<string>;
  date: string;
}): boolean {
  if (accountStart === null) return false;
  return isBefore(parseIsoDay(date), parseIsoDay(accountStart));
}

export function isConfirmedNewAccount({
  accountCreatedDay,
  reliableFrom,
}: {
  accountCreatedDay: Nullable<string>;
  reliableFrom: string;
}): boolean {
  if (accountCreatedDay === null) return false;
  const latestReliableFrom = addDays(
    parseIsoDay(accountCreatedDay),
    ACCOUNT_HISTORY.reliableFromToleranceDays,
  );
  return !isAfter(parseIsoDay(reliableFrom), latestReliableFrom);
}

export function newAccountStart({
  meta,
  user,
}: {
  meta: ReadingStatisticsMeta;
  user: AccountUser;
}): Nullable<string> {
  const createdDay = accountCreatedDay({ timeZone: meta.timezone, user });
  const isNew = isConfirmedNewAccount({
    accountCreatedDay: createdDay,
    reliableFrom: meta.activityHistory.reliableFrom,
  });
  return isNew ? createdDay : null;
}

export function withNewAccountHistory({
  accountStart,
  calendar,
}: {
  accountStart: Nullable<string>;
  calendar: ReadingStatisticsCalendarSection;
}): ReadingStatisticsCalendarSection {
  if (accountStart === null) return calendar;
  return {
    ...calendar,
    days: calendar.days.map((day): StatisticsCalendarDay => ({ ...day, historyQuality: "exact" })),
  };
}
