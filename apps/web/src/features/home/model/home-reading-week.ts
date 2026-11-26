import type { HomeReadingWeek, HomeReadingWeekDay, Nullable } from "@app/shared";

import { assertNever } from "@/lib/assert-never";

import { readingCalendarDayHref } from "./home-context-links";

export type HomeWeekDayPreview = {
  booksCount: Nullable<number>;
  pagesRead: Nullable<number>;
};

export type HomeWeekSummary =
  | { kind: "activeDays"; value: number }
  | { kind: "exactPages"; value: number }
  | { kind: "minimumPages"; value: number };

export function homeWeekDayHref(day: HomeReadingWeekDay): Nullable<string> {
  return day.status === "future" ? null : readingCalendarDayHref(day.date);
}

export function homeWeekDayPreview(day: HomeReadingWeekDay): Nullable<HomeWeekDayPreview> {
  if (day.status !== "active") return null;
  if (day.pagesRead === null && day.booksCount === null) return null;
  return { booksCount: day.booksCount, pagesRead: day.pagesRead };
}

export function homeWeekStreakDays(week: HomeReadingWeek): Nullable<number> {
  const { currentStreak } = week;
  if (currentStreak.availability === "unavailable") return null;
  return currentStreak.data?.days ?? null;
}

export function homeWeekSummary(week: HomeReadingWeek): HomeWeekSummary {
  switch (week.pages.quality) {
    case "exact":
      return { kind: "exactPages", value: week.pages.value };
    case "lower_bound":
      return { kind: "minimumPages", value: week.pages.value };
    case "unavailable":
      return { kind: "activeDays", value: week.activeDays };
    default:
      return assertNever(week.pages);
  }
}

export function isConfirmedQuietWeek(week: HomeReadingWeek): boolean {
  return (
    week.activeDays === 0 &&
    week.days.every((day) => day.status === "inactive" || day.status === "future")
  );
}
