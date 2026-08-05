import type {
  Nullable,
  ReadingActivityPointView,
  ReadingActivityRange,
  ReadingDaySummaryView,
  ReadingHistoryDayView,
  ReadingHistoryQuery,
  ReadingHistorySort,
  ReadingHistoryView,
  ReadingStatus,
} from "@app/shared";

import { compareAsc } from "date-fns";

import {
  addDaysToIsoDate,
  daysBetweenIsoDates,
  toIsoDate,
  toNullableIsoDate,
  toNullableIsoDateTime,
} from "../../../core/iso-date.js";

const SEVEN_DAY_WINDOW = 7;
const FOURTEEN_DAY_WINDOW = 14;
const MIN_ACTIVE_DAYS_FOR_FORECAST = 2;
export const READING_ACTIVITY_ALL_MAX_DAYS = 3660;

export type ReadingEventRow = {
  createdAt: Date;
  date: Date;
  id: string;
  page: number;
  pagesRead: number;
};

export type ReadingProgressSnapshot = {
  abandonedAt: Nullable<Date>;
  currentPage: Nullable<number>;
  finishedAt: Nullable<Date>;
  lastProgressUpdateAt: Nullable<Date>;
  pausedAt: Nullable<Date>;
  startedAt: Nullable<Date>;
};

type DayGroup = {
  date: string;
  events: NormalizedEvent[];
  finalPage: number;
  pagesRead: number;
  startPage: number;
  updatesCount: number;
};

type NormalizedEvent = {
  createdAt: Date;
  date: string;
  id: string;
  page: number;
  pagesRead: number;
};

export function toReadingHistoryView(args: {
  events: ReadingEventRow[];
  pagesCount: Nullable<number>;
  progress: ReadingProgressSnapshot;
  query: ReadingHistoryQuery;
  readingStatus: ReadingStatus;
  today: Date;
}): ReadingHistoryView {
  const { pagesCount, progress, query, readingStatus } = args;

  const todayIso = toIsoDate(args.today);
  const days = groupEventsByDay(args.events);
  const totalEvents = countEvents(days);
  const trackedPagesRead = sumPagesRead(days);
  const currentPage = progress.currentPage ?? 0;

  const earliestEventDate = days.at(0)?.date ?? null;
  const lastDay = days.at(-1) ?? null;
  const latestEventDate = lastDay?.date ?? null;

  const startDate = toNullableIsoDate(progress.startedAt) ?? earliestEventDate;
  const endDate = resolvePeriodEndDate({
    abandonedAt: toNullableIsoDate(progress.abandonedAt),
    finishedAt: toNullableIsoDate(progress.finishedAt),
    latestEventDate,
    pausedAt: toNullableIsoDate(progress.pausedAt),
    status: readingStatus,
    todayIso,
  });

  const activeDaysCount = days.length;
  const averagePagesPerActiveDay =
    activeDaysCount > 0 ? roundToOneDecimal(trackedPagesRead / activeDaysCount) : null;
  const pagesRemaining = pagesCount === null ? null : Math.max(pagesCount - currentPage, 0);
  const untrackedPages = Math.max(currentPage - trackedPagesRead, 0);

  const summary: ReadingHistoryView["summary"] = {
    abandonedAt: toNullableIsoDateTime(progress.abandonedAt),
    activeDaysCount,
    averagePagesPerActiveDay,
    bestDay: pickBestDay(days),
    currentPage,
    estimatedActiveDaysRemaining: estimateActiveDaysRemaining({
      activeDaysCount,
      averagePagesPerActiveDay,
      pagesCount,
      pagesRemaining,
      status: readingStatus,
    }),
    finishedAt: toNullableIsoDateTime(progress.finishedAt),
    historyCompleteness: {
      isComplete: untrackedPages === 0,
      untrackedPages,
    },
    lastActivity: lastDay === null ? null : toDaySummary(lastDay),
    lastProgressUpdateAt: toNullableIsoDateTime(progress.lastProgressUpdateAt),
    pagesCount,
    pagesRemaining,
    pausedAt: toNullableIsoDateTime(progress.pausedAt),
    progressPercent:
      pagesCount !== null && pagesCount > 0
        ? Math.min(100, Math.round((currentPage / pagesCount) * 100))
        : null,
    readingPeriod: {
      calendarDays:
        startDate !== null && endDate !== null
          ? daysBetweenIsoDates({ endIsoDate: endDate, startIsoDate: startDate }) + 1
          : null,
      endDate,
      startDate,
    },
    startedAt: toNullableIsoDateTime(progress.startedAt),
    status: readingStatus,
    trackedPagesRead,
    updatesCount: totalEvents,
  };

  const activity = buildActivity({
    anchorDate: resolveActivityAnchorDate({
      abandonedAt: toNullableIsoDate(progress.abandonedAt),
      finishedAt: toNullableIsoDate(progress.finishedAt),
      latestEventDate,
      pausedAt: toNullableIsoDate(progress.pausedAt),
      status: readingStatus,
      todayIso,
    }),
    days,
    periodEndDate: endDate,
    periodStartDate: startDate,
    range: query.activityRange,
  });

  const history = buildHistory({ days, limit: query.limit, page: query.page, sort: query.sort });

  return { activity, history, summary };
}

function buildActivity(args: {
  anchorDate: string;
  days: DayGroup[];
  periodEndDate: Nullable<string>;
  periodStartDate: Nullable<string>;
  range: ReadingActivityRange;
}): ReadingHistoryView["activity"] {
  const dayByDate = new Map(args.days.map((day) => [day.date, day]));
  const bounds = resolveActivityBounds(args);

  if (bounds === null) {
    return {
      from: null,
      points: [],
      range: args.range,
      summary: {
        activeDaysCount: 0,
        averagePagesPerActiveDay: null,
        bestDay: null,
        pagesRead: 0,
        updatesCount: 0,
      },
      to: null,
    };
  }

  const points = enumerateDates(bounds.from, bounds.to).map((date) =>
    toActivityPoint(date, dayByDate.get(date)),
  );

  return {
    from: bounds.from,
    points,
    range: args.range,
    summary: summarizeActivity(points),
    to: bounds.to,
  };
}

function buildHistory(args: {
  days: DayGroup[];
  limit: number;
  page: number;
  sort: ReadingHistorySort;
}): ReadingHistoryView["history"] {
  const totalDays = args.days.length;
  const totalPages = Math.ceil(totalDays / args.limit);

  const orderedDays = args.sort === "desc" ? [...args.days].reverse() : args.days;
  const start = (args.page - 1) * args.limit;
  const pageDays = orderedDays.slice(start, start + args.limit);

  return {
    days: pageDays.map((day) => toHistoryDay(day, args.sort)),
    pagination: {
      hasNextPage: args.page < totalPages,
      hasPreviousPage: args.page > 1,
      limit: args.limit,
      page: args.page,
      totalDays,
      totalPages,
    },
  };
}

function clampAllRangeStart(periodStartDate: string, periodEndDate: string): string {
  const spanDays =
    daysBetweenIsoDates({ endIsoDate: periodEndDate, startIsoDate: periodStartDate }) + 1;
  if (spanDays <= READING_ACTIVITY_ALL_MAX_DAYS) {
    return periodStartDate;
  }
  return addDaysToIsoDate(periodEndDate, -(READING_ACTIVITY_ALL_MAX_DAYS - 1));
}

function compareChronological(left: NormalizedEvent, right: NormalizedEvent): number {
  const byCreatedAt = compareAsc(left.createdAt, right.createdAt);
  if (byCreatedAt !== 0) {
    return byCreatedAt;
  }
  return left.id.localeCompare(right.id);
}

function countEvents(days: DayGroup[]): number {
  return days.reduce((total, day) => total + day.updatesCount, 0);
}

function enumerateDates(fromIso: string, toIso: string): string[] {
  const dates: string[] = [];
  const totalDays = daysBetweenIsoDates({ endIsoDate: toIso, startIsoDate: fromIso });
  for (let offset = 0; offset <= totalDays; offset += 1) {
    dates.push(addDaysToIsoDate(fromIso, offset));
  }
  return dates;
}

function estimateActiveDaysRemaining(args: {
  activeDaysCount: number;
  averagePagesPerActiveDay: Nullable<number>;
  pagesCount: Nullable<number>;
  pagesRemaining: Nullable<number>;
  status: ReadingStatus;
}): Nullable<number> {
  const isActiveReading = args.status === "reading" || args.status === "rereading";
  if (
    !isActiveReading ||
    args.pagesCount === null ||
    args.pagesRemaining === null ||
    args.pagesRemaining <= 0 ||
    args.activeDaysCount < MIN_ACTIVE_DAYS_FOR_FORECAST ||
    args.averagePagesPerActiveDay === null ||
    args.averagePagesPerActiveDay <= 0
  ) {
    return null;
  }
  return Math.ceil(args.pagesRemaining / args.averagePagesPerActiveDay);
}

function groupEventsByDay(events: ReadingEventRow[]): DayGroup[] {
  const grouped = new Map<string, NormalizedEvent[]>();
  for (const event of events) {
    const date = toIsoDate(event.date);
    const dayEvents = grouped.get(date) ?? [];
    dayEvents.push({
      createdAt: event.createdAt,
      date,
      id: event.id,
      page: event.page,
      pagesRead: event.pagesRead,
    });
    grouped.set(date, dayEvents);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([date, dayEvents]) => {
      const ordered = [...dayEvents].sort(compareChronological);
      const first = ordered.at(0);
      const last = ordered.at(-1);
      if (first === undefined || last === undefined) {
        return [];
      }
      return [
        {
          date,
          events: ordered,
          finalPage: last.page,
          pagesRead: ordered.reduce((total, event) => total + event.pagesRead, 0),
          startPage: first.page - first.pagesRead,
          updatesCount: ordered.length,
        },
      ];
    });
}

function pickBestDay(days: DayGroup[]): Nullable<ReadingDaySummaryView> {
  let best: Nullable<DayGroup> = null;
  for (const day of days) {
    if (best === null || day.pagesRead >= best.pagesRead) {
      best = day;
    }
  }
  return best === null ? null : toDaySummary(best);
}

function resolveActivityAnchorDate(args: {
  abandonedAt: Nullable<string>;
  finishedAt: Nullable<string>;
  latestEventDate: Nullable<string>;
  pausedAt: Nullable<string>;
  status: ReadingStatus;
  todayIso: string;
}): string {
  switch (args.status) {
    case "dnf":
      return args.abandonedAt ?? args.latestEventDate ?? args.todayIso;
    case "finished":
      return args.finishedAt ?? args.latestEventDate ?? args.todayIso;
    case "not_started":
    case "want_to_read":
      return args.latestEventDate ?? args.todayIso;
    case "paused":
      return args.pausedAt ?? args.latestEventDate ?? args.todayIso;
    case "reading":
    case "rereading":
      return args.todayIso;
    default: {
      const exhaustiveCheck: never = args.status;
      return exhaustiveCheck;
    }
  }
}

function resolveActivityBounds(args: {
  anchorDate: string;
  periodEndDate: Nullable<string>;
  periodStartDate: Nullable<string>;
  range: ReadingActivityRange;
}): Nullable<{ from: string; to: string }> {
  if (args.range === "all") {
    if (args.periodStartDate === null || args.periodEndDate === null) {
      return null;
    }
    return {
      from: clampAllRangeStart(args.periodStartDate, args.periodEndDate),
      to: args.periodEndDate,
    };
  }

  const windowSize = args.range === "7d" ? SEVEN_DAY_WINDOW : FOURTEEN_DAY_WINDOW;
  const from = addDaysToIsoDate(args.anchorDate, -(windowSize - 1));
  return { from, to: args.anchorDate };
}

function resolvePeriodEndDate(args: {
  abandonedAt: Nullable<string>;
  finishedAt: Nullable<string>;
  latestEventDate: Nullable<string>;
  pausedAt: Nullable<string>;
  status: ReadingStatus;
  todayIso: string;
}): Nullable<string> {
  switch (args.status) {
    case "dnf":
      return args.abandonedAt ?? args.latestEventDate ?? args.todayIso;
    case "finished":
      return args.finishedAt ?? args.latestEventDate ?? args.todayIso;
    case "not_started":
    case "want_to_read":
      return args.latestEventDate;
    case "paused":
      return args.pausedAt ?? args.latestEventDate ?? args.todayIso;
    case "reading":
    case "rereading":
      return args.todayIso;
    default: {
      const exhaustiveCheck: never = args.status;
      return exhaustiveCheck;
    }
  }
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function summarizeActivity(
  points: ReadingActivityPointView[],
): ReadingHistoryView["activity"]["summary"] {
  const activePoints = points.filter((point) => point.hasActivity);
  const pagesRead = activePoints.reduce((total, point) => total + point.pagesRead, 0);
  const updatesCount = activePoints.reduce((total, point) => total + point.updatesCount, 0);
  const activeDaysCount = activePoints.length;

  let bestPoint: Nullable<ReadingActivityPointView> = null;
  for (const point of activePoints) {
    if (bestPoint === null || point.pagesRead >= bestPoint.pagesRead) {
      bestPoint = point;
    }
  }

  return {
    activeDaysCount,
    averagePagesPerActiveDay:
      activeDaysCount > 0 ? roundToOneDecimal(pagesRead / activeDaysCount) : null,
    bestDay:
      bestPoint === null
        ? null
        : {
            date: bestPoint.date,
            finalPage: bestPoint.finalPage,
            pagesRead: bestPoint.pagesRead,
            updatesCount: bestPoint.updatesCount,
          },
    pagesRead,
    updatesCount,
  };
}

function sumPagesRead(days: DayGroup[]): number {
  return days.reduce((total, day) => total + day.pagesRead, 0);
}

function toActivityPoint(date: string, day: DayGroup | undefined): ReadingActivityPointView {
  if (day === undefined) {
    return {
      date,
      finalPage: null,
      hasActivity: false,
      pagesRead: 0,
      startPage: null,
      updatesCount: 0,
    };
  }
  return {
    date,
    finalPage: day.finalPage,
    hasActivity: true,
    pagesRead: day.pagesRead,
    startPage: day.startPage,
    updatesCount: day.updatesCount,
  };
}

function toDaySummary(day: DayGroup): ReadingDaySummaryView {
  return {
    date: day.date,
    finalPage: day.finalPage,
    pagesRead: day.pagesRead,
    updatesCount: day.updatesCount,
  };
}

function toHistoryDay(day: DayGroup, sort: ReadingHistorySort): ReadingHistoryDayView {
  const orderedEvents = sort === "desc" ? [...day.events].reverse() : day.events;
  return {
    date: day.date,
    events: orderedEvents.map((event) => ({
      date: event.date,
      id: event.id,
      page: event.page,
      pagesRead: event.pagesRead,
      recordedAt: event.createdAt.toISOString(),
    })),
    finalPage: day.finalPage,
    pagesRead: day.pagesRead,
    startPage: day.startPage,
    updatesCount: day.updatesCount,
  };
}
