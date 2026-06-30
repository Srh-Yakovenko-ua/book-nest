import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const UTC_TIME_ZONE = "UTC";
const ISO_DATE_FORMAT = "yyyy-MM-dd";

export function parseIsoDate(value: string): Date {
  return fromZonedTime(`${value}T00:00:00.000`, UTC_TIME_ZONE);
}

export function toIsoDate(date: Date): string {
  return formatInTimeZone(date, UTC_TIME_ZONE, ISO_DATE_FORMAT);
}
