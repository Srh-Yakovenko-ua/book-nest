import { format, isValid, parse } from "date-fns";

const ISO_DAY = { format: "yyyy-MM-dd" } as const;

export function dateToIsoDay(date: Date): string {
  return format(date, ISO_DAY.format);
}

export function isoDayToDate(value: string | undefined): Date | undefined {
  if (value === undefined || value === "") return undefined;
  const parsed = parse(value, ISO_DAY.format, new Date());
  return isValid(parsed) ? parsed : undefined;
}
