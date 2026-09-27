import type { NoteView } from "@app/shared";

import { differenceInCalendarDays, differenceInMinutes, parseISO } from "date-fns";

import { parseIsoDay } from "@/lib/format";

const NOTE_DATES = {
  meaningfulUpdateMinutes: 1,
} as const;

export function isMeaningfullyUpdated({
  createdAt,
  updatedAt,
}: Pick<NoteView, "createdAt" | "updatedAt">): boolean {
  return (
    differenceInMinutes(parseISO(updatedAt), parseISO(createdAt)) >=
    NOTE_DATES.meaningfulUpdateMinutes
  );
}

export function relativeDayFromToday(isoDay: string, locale: string): string {
  const days = differenceInCalendarDays(parseIsoDay(isoDay), new Date());
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(days, "day");
}
