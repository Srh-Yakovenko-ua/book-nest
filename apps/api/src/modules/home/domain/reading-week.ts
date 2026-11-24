import type {
  HomeReadingWeek,
  HomeReadingWeekDay,
  HomeReadingWeekPages,
  ReadingStatisticsDateRange,
  StatisticsCalendarHistoryQuality,
  StatisticsCurrentStreak,
  WeekStartDay,
} from "@app/shared";

import { HOME_DASHBOARD_RULES, WEEK_STARTS_ON } from "@app/shared";
import { addDays, format, parseISO, startOfWeek } from "date-fns";

import type { HomeTemporalContext } from "./home-temporal-context.js";

export type WeekActivityDay = {
  booksCount: number;
  date: string;
  historyQuality: StatisticsCalendarHistoryQuality;
  pagesRead: number;
};

export type WeekActivityInput = {
  currentStreak: StatisticsCurrentStreak;
  days: WeekActivityDay[];
  hasReadingHistory: boolean;
  periodReliable: boolean;
};

const ISO_DAY_FORMAT = "yyyy-MM-dd";

const LAST_WEEK_DAY_OFFSET = HOME_DASHBOARD_RULES.week.daysCount - 1;

export function buildHomeReadingWeek({
  activity,
  period,
  temporal,
}: {
  activity: WeekActivityInput;
  period: ReadingStatisticsDateRange;
  temporal: HomeTemporalContext;
}): HomeReadingWeek {
  const days = activity.days.map((day) => toWeekDay({ day, today: temporal.today }));
  const observedPages = activity.days
    .filter((day) => day.date <= temporal.today)
    .reduce((sum, day) => sum + day.pagesRead, 0);

  return {
    activeDays: days.filter((day) => day.status === "active").length,
    currentStreak: activity.currentStreak,
    days,
    hasReadingHistory: activity.hasReadingHistory,
    pages: resolveWeekPages({ observedPages, periodReliable: activity.periodReliable }),
    period,
    timezone: temporal.timeZone,
    today: temporal.today,
    weekStartDay: temporal.weekStartDay,
  };
}

export function resolveCalendarWeek({
  today,
  weekStartDay,
}: {
  today: string;
  weekStartDay: WeekStartDay;
}): ReadingStatisticsDateRange {
  const weekStart = startOfWeek(parseISO(today), { weekStartsOn: WEEK_STARTS_ON[weekStartDay] });
  return {
    from: format(weekStart, ISO_DAY_FORMAT),
    to: format(addDays(weekStart, LAST_WEEK_DAY_OFFSET), ISO_DAY_FORMAT),
  };
}

export function resolveWeekPages({
  observedPages,
  periodReliable,
}: {
  observedPages: number;
  periodReliable: boolean;
}): HomeReadingWeekPages {
  if (periodReliable) {
    return { quality: "exact", value: observedPages };
  }
  if (observedPages > 0) {
    return { quality: "lower_bound", value: observedPages };
  }
  return { quality: "unavailable" };
}

export function toWeekDay({
  day,
  today,
}: {
  day: WeekActivityDay;
  today: string;
}): HomeReadingWeekDay {
  if (day.date > today) {
    return { booksCount: null, date: day.date, pagesRead: null, status: "future" };
  }
  if (day.pagesRead > 0) {
    return {
      booksCount: day.booksCount,
      date: day.date,
      pagesRead: day.pagesRead,
      status: "active",
    };
  }
  if (day.historyQuality === "legacy_observed_only") {
    return { booksCount: null, date: day.date, pagesRead: null, status: "unknown" };
  }
  return { booksCount: 0, date: day.date, pagesRead: 0, status: "inactive" };
}
