import type { Nullable } from "@app/shared";

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const UTC_TIME_ZONE = "UTC";
const ISO_DATE_FORMAT = "yyyy-MM-dd";
const MILLISECONDS_PER_DAY = 86_400_000;

export function addIsoDays(isoDate: string, days: number): string {
  const shifted = new Date(parseIsoDate(isoDate).getTime() + days * MILLISECONDS_PER_DAY);
  return toIsoDate(shifted);
}

export function differenceInIsoDays(startIsoDate: string, endIsoDate: string): number {
  const spanMs = parseIsoDate(endIsoDate).getTime() - parseIsoDate(startIsoDate).getTime();
  return Math.round(spanMs / MILLISECONDS_PER_DAY);
}

export function parseIsoDate(value: string): Date {
  return fromZonedTime(`${value}T00:00:00.000`, UTC_TIME_ZONE);
}

export function toIsoDate(date: Date): string {
  return formatInTimeZone(date, UTC_TIME_ZONE, ISO_DATE_FORMAT);
}

export function toNullableIsoDate(value: Nullable<Date>): Nullable<string> {
  return value === null ? null : toIsoDate(value);
}
