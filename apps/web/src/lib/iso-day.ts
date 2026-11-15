import { format, isValid, parse } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export const ISO_DAY = { format: "yyyy-MM-dd", pattern: /^\d{4}-\d{2}-\d{2}$/ } as const;

export function dateToIsoDay(date: Date): string {
  return format(date, ISO_DAY.format);
}

export function isoDayToDate(value: string | undefined): Date | undefined {
  if (value === undefined || value === "") return undefined;
  const parsed = parse(value, ISO_DAY.format, new Date());
  return isValid(parsed) ? parsed : undefined;
}

export function todayIsoDay(timeZone: string): string {
  return formatInTimeZone(new Date(), timeZone, ISO_DAY.format);
}
