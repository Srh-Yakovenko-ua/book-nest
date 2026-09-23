import { differenceInCalendarDays, differenceInMonths, parseISO } from "date-fns";

export type GenreTenure = { count: number; unit: GenreTenureUnit };

export type GenreTenureUnit = "day" | "month" | "week";

const GENRE_TENURE = {
  daysPerWeek: 7,
  minimumCount: 1,
} as const;

export function genreTenure(firstAddedAt: string, now: Date): GenreTenure {
  const firstAdded = parseISO(firstAddedAt);
  const months = differenceInMonths(now, firstAdded);
  if (months >= GENRE_TENURE.minimumCount) return { count: months, unit: "month" };

  const days = differenceInCalendarDays(now, firstAdded);
  if (days >= GENRE_TENURE.daysPerWeek) {
    return { count: Math.floor(days / GENRE_TENURE.daysPerWeek), unit: "week" };
  }

  return { count: Math.max(GENRE_TENURE.minimumCount, days), unit: "day" };
}
