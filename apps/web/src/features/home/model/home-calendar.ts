import type { Nullable } from "@app/shared";

import {
  addDays,
  compareAsc,
  differenceInMilliseconds,
  isAfter,
  milliseconds,
  startOfWeek,
} from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import type { WeekStartsOn } from "@/features/settings";

import { parseIsoDay } from "@/lib/format";
import { dateToIsoDay, ISO_DAY } from "@/lib/iso-day";

export type HomeCalendar = {
  partOfDay: Nullable<HomePartOfDay>;
  timeZone: string;
  today: string;
  weekStart: string;
  weekStartsOn: WeekStartsOn;
};

export type HomePartOfDay = "day" | "evening" | "morning" | "night";

const HOME_CALENDAR = {
  boundarySettle: milliseconds({ seconds: 1 }),
  fallbackTimeZone: "UTC",
  hourFormat: "H",
  partStartHours: { day: 12, evening: 18, morning: 5, night: 23 },
} as const;

export function homeCalendar({
  now,
  timeZone,
  weekStartsOn,
}: {
  now: Date;
  timeZone: string;
  weekStartsOn: WeekStartsOn;
}): HomeCalendar {
  const hour = zonedHour({ now, timeZone });
  const resolvedTimeZone = hour === null ? HOME_CALENDAR.fallbackTimeZone : timeZone;
  const today = formatInTimeZone(now, resolvedTimeZone, ISO_DAY.format);

  return {
    partOfDay: hour === null ? null : partOfDayForHour(hour),
    timeZone: resolvedTimeZone,
    today,
    weekStart: dateToIsoDay(startOfWeek(parseIsoDay(today), { weekStartsOn })),
    weekStartsOn,
  };
}

export function isSameCalendarSlot({
  left,
  right,
  timeZone,
}: {
  left: Date;
  right: Date;
  timeZone: string;
}): boolean {
  return calendarSlot({ now: left, timeZone }) === calendarSlot({ now: right, timeZone });
}

export function millisecondsUntilNextBoundary({
  now,
  timeZone,
}: {
  now: Date;
  timeZone: string;
}): number {
  const boundary = nextCalendarBoundary({ now, timeZone });
  return Math.max(0, differenceInMilliseconds(boundary, now)) + HOME_CALENDAR.boundarySettle;
}

export function nextCalendarBoundary({ now, timeZone }: { now: Date; timeZone: string }): Date {
  const today = formatInTimeZone(now, timeZone, ISO_DAY.format);
  const tomorrow = dateToIsoDay(addDays(parseIsoDay(today), 1));
  const nextMidnight = zonedHourStart({ day: tomorrow, hour: 0, timeZone });
  const [nextPartStart] = Object.values(HOME_CALENDAR.partStartHours)
    .map((hour) => zonedHourStart({ day: today, hour, timeZone }))
    .filter((instant) => isAfter(instant, now))
    .sort(compareAsc);

  return nextPartStart ?? nextMidnight;
}

export function partOfDayForHour(hour: number): HomePartOfDay {
  const starts = HOME_CALENDAR.partStartHours;
  if (hour >= starts.night || hour < starts.morning) return "night";
  if (hour >= starts.evening) return "evening";
  if (hour >= starts.day) return "day";
  return "morning";
}

function calendarSlot({ now, timeZone }: { now: Date; timeZone: string }): string {
  const hour = zonedHour({ now, timeZone });
  if (hour === null) return "unknown";
  return `${formatInTimeZone(now, timeZone, ISO_DAY.format)}:${partOfDayForHour(hour)}`;
}

function zonedHour({ now, timeZone }: { now: Date; timeZone: string }): Nullable<number> {
  try {
    return Number(formatInTimeZone(now, timeZone, HOME_CALENDAR.hourFormat));
  } catch {
    return null;
  }
}

function zonedHourStart({
  day,
  hour,
  timeZone,
}: {
  day: string;
  hour: number;
  timeZone: string;
}): Date {
  return fromZonedTime(`${day}T${String(hour).padStart(2, "0")}:00:00`, timeZone);
}
