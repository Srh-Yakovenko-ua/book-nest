import type {
  Nullable,
  ReadingHistoryDayView,
  ReadingHistoryEventView,
  ReadingHistoryQuery,
  ReadingHistoryView,
  ReadingStatus,
} from "@app/shared";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ReadingEventRow, ReadingProgressSnapshot } from "./reading-history.mapper.js";

import { READING_ACTIVITY_ALL_MAX_DAYS, toReadingHistoryView } from "./reading-history.mapper.js";

const TODAY = utc("2026-03-12T00:00:00.000Z");

const EMPTY_SNAPSHOT: ReadingProgressSnapshot = {
  abandonedAt: null,
  currentPage: null,
  finishedAt: null,
  lastProgressUpdateAt: null,
  pausedAt: null,
  startedAt: null,
};

const DEFAULT_QUERY: ReadingHistoryQuery = {
  activityRange: "7d",
  limit: 20,
  page: 1,
  sort: "desc",
};

function buildView(args: {
  events?: ReadingEventRow[];
  pagesCount?: Nullable<number>;
  progress?: Partial<ReadingProgressSnapshot>;
  query?: Partial<ReadingHistoryQuery>;
  readingStatus?: ReadingStatus;
  today?: Date;
}): ReadingHistoryView {
  return toReadingHistoryView({
    events: args.events ?? [],
    pagesCount: args.pagesCount === undefined ? 320 : args.pagesCount,
    progress: snapshot(args.progress ?? {}),
    query: query(args.query ?? {}),
    readingStatus: args.readingStatus ?? "reading",
    today: args.today ?? TODAY,
  });
}

function event(args: {
  createdAt?: string;
  date: string;
  id: string;
  page: number;
  pagesRead: number;
}): ReadingEventRow {
  return {
    createdAt: utc(args.createdAt ?? `${args.date}T12:00:00.000Z`),
    date: utc(`${args.date}T00:00:00.000Z`),
    id: args.id,
    page: args.page,
    pagesRead: args.pagesRead,
  };
}

function firstDay(view: ReadingHistoryView): ReadingHistoryDayView {
  const day = view.history.days.at(0);
  if (day === undefined) {
    throw new Error("expected at least one history day");
  }
  return day;
}

function firstEvent(day: ReadingHistoryDayView): ReadingHistoryEventView {
  const entry = day.events.at(0);
  if (entry === undefined) {
    throw new Error("expected at least one day event");
  }
  return entry;
}

function multiDayEvents(): ReadingEventRow[] {
  return [
    {
      createdAt: "2026-03-05T10:00:00.000Z",
      date: "2026-03-05",
      id: "e1",
      page: 100,
      pagesRead: 100,
    },
    {
      createdAt: "2026-03-08T09:00:00.000Z",
      date: "2026-03-08",
      id: "e2",
      page: 150,
      pagesRead: 50,
    },
    {
      createdAt: "2026-03-08T18:00:00.000Z",
      date: "2026-03-08",
      id: "e3",
      page: 215,
      pagesRead: 65,
    },
    {
      createdAt: "2026-03-12T10:20:00.000Z",
      date: "2026-03-12",
      id: "e4",
      page: 225,
      pagesRead: 10,
    },
    {
      createdAt: "2026-03-12T16:40:00.000Z",
      date: "2026-03-12",
      id: "e5",
      page: 240,
      pagesRead: 15,
    },
    {
      createdAt: "2026-03-12T21:10:00.000Z",
      date: "2026-03-12",
      id: "e6",
      page: 250,
      pagesRead: 10,
    },
  ].map(event);
}

function query(overrides: Partial<ReadingHistoryQuery>): ReadingHistoryQuery {
  return { ...DEFAULT_QUERY, ...overrides };
}

function snapshot(overrides: Partial<ReadingProgressSnapshot>): ReadingProgressSnapshot {
  return { ...EMPTY_SNAPSHOT, ...overrides };
}

function threeEventDay(): ReadingEventRow[] {
  return [
    {
      createdAt: "2026-03-12T10:20:00.000Z",
      date: "2026-03-12",
      id: "a",
      page: 225,
      pagesRead: 10,
    },
    {
      createdAt: "2026-03-12T16:40:00.000Z",
      date: "2026-03-12",
      id: "b",
      page: 240,
      pagesRead: 15,
    },
    {
      createdAt: "2026-03-12T21:10:00.000Z",
      date: "2026-03-12",
      id: "c",
      page: 250,
      pagesRead: 10,
    },
  ].map(event);
}

function utc(value: string): Date {
  return new Date(value);
}

describe("toReadingHistoryView summary", () => {
  it("returns a neutral summary and empty history for a book with no events", () => {
    const view = buildView({ events: [], progress: { currentPage: 0 } });

    expect(view.summary.activeDaysCount).toBe(0);
    expect(view.summary.updatesCount).toBe(0);
    expect(view.summary.trackedPagesRead).toBe(0);
    expect(view.summary.averagePagesPerActiveDay).toBeNull();
    expect(view.summary.bestDay).toBeNull();
    expect(view.summary.lastActivity).toBeNull();
    expect(view.summary.estimatedActiveDaysRemaining).toBeNull();
    expect(view.summary.historyCompleteness).toEqual({ isComplete: true, untrackedPages: 0 });
    expect(view.history.days).toEqual([]);
    expect(view.history.pagination).toMatchObject({
      hasNextPage: false,
      hasPreviousPage: false,
      totalDays: 0,
      totalPages: 0,
    });
  });

  it("summarizes a single event as one active day equal to its pages read", () => {
    const view = buildView({
      events: [event({ date: "2026-03-08", id: "e1", page: 40, pagesRead: 40 })],
      progress: { currentPage: 40, startedAt: utc("2026-03-08T00:00:00.000Z") },
    });

    expect(view.summary.activeDaysCount).toBe(1);
    expect(view.summary.updatesCount).toBe(1);
    expect(view.summary.trackedPagesRead).toBe(40);
    expect(view.summary.averagePagesPerActiveDay).toBe(40);
    expect(view.summary.bestDay).toMatchObject({
      date: "2026-03-08",
      finalPage: 40,
      pagesRead: 40,
      updatesCount: 1,
    });
    expect(view.summary.lastActivity).toMatchObject({ date: "2026-03-08", pagesRead: 40 });
  });

  it("aggregates several events that share one calendar day", () => {
    const view = buildView({
      events: [
        event({
          createdAt: "2026-03-08T09:00:00.000Z",
          date: "2026-03-08",
          id: "e1",
          page: 20,
          pagesRead: 20,
        }),
        event({
          createdAt: "2026-03-08T18:00:00.000Z",
          date: "2026-03-08",
          id: "e2",
          page: 60,
          pagesRead: 40,
        }),
      ],
      progress: { currentPage: 60 },
    });

    expect(view.summary.activeDaysCount).toBe(1);
    expect(view.summary.updatesCount).toBe(2);
    expect(view.summary.trackedPagesRead).toBe(60);
    expect(view.history.days[0]).toMatchObject({ finalPage: 60, startPage: 0, updatesCount: 2 });
  });

  it("counts unique calendar days across a multi-day history", () => {
    const view = buildView({ events: multiDayEvents(), progress: { currentPage: 250 } });

    expect(view.summary.activeDaysCount).toBe(3);
    expect(view.summary.updatesCount).toBe(6);
    expect(view.summary.trackedPagesRead).toBe(250);
    expect(view.summary.averagePagesPerActiveDay).toBe(83.3);
  });

  it("computes progressPercent from the current page and page count", () => {
    const view = buildView({
      events: multiDayEvents(),
      pagesCount: 320,
      progress: { currentPage: 250 },
    });

    expect(view.summary.progressPercent).toBe(78);
  });

  it("clamps progressPercent to 100 when the current page reaches the page count", () => {
    const view = buildView({ pagesCount: 320, progress: { currentPage: 320 } });

    expect(view.summary.progressPercent).toBe(100);
  });

  it("returns null progress and remaining pages when the page count is unknown", () => {
    const view = buildView({ pagesCount: null, progress: { currentPage: 120 } });

    expect(view.summary.progressPercent).toBeNull();
    expect(view.summary.pagesRemaining).toBeNull();
  });

  it("computes pagesRemaining from the page count and current page", () => {
    const view = buildView({ pagesCount: 320, progress: { currentPage: 250 } });

    expect(view.summary.pagesRemaining).toBe(70);
  });

  it("clamps pagesRemaining to zero when the current page exceeds the page count", () => {
    const view = buildView({ pagesCount: 320, progress: { currentPage: 350 } });

    expect(view.summary.pagesRemaining).toBe(0);
  });

  it("rounds the average pace to one decimal place", () => {
    const view = buildView({
      events: [
        event({ date: "2026-03-06", id: "e1", page: 45, pagesRead: 45 }),
        event({ date: "2026-03-07", id: "e2", page: 85, pagesRead: 40 }),
      ],
      progress: { currentPage: 85 },
    });

    expect(view.summary.averagePagesPerActiveDay).toBe(42.5);
  });

  it("selects the day with the most pages read as the best day", () => {
    const view = buildView({ events: multiDayEvents(), progress: { currentPage: 250 } });

    expect(view.summary.bestDay).toMatchObject({
      date: "2026-03-08",
      finalPage: 215,
      pagesRead: 115,
      updatesCount: 2,
    });
  });

  it("breaks a best-day tie in favour of the most recent day", () => {
    const view = buildView({
      events: [
        event({ date: "2026-03-05", id: "e1", page: 40, pagesRead: 40 }),
        event({ date: "2026-03-07", id: "e2", page: 80, pagesRead: 40 }),
      ],
      progress: { currentPage: 80 },
    });

    expect(view.summary.bestDay?.date).toBe("2026-03-07");
  });

  it("reports the most recent active day as the last activity", () => {
    const view = buildView({ events: multiDayEvents(), progress: { currentPage: 250 } });

    expect(view.summary.lastActivity).toMatchObject({
      date: "2026-03-12",
      finalPage: 250,
      pagesRead: 35,
      updatesCount: 3,
    });
  });

  it("counts the reading period inclusively across both endpoints", () => {
    const view = buildView({
      progress: {
        finishedAt: utc("2026-03-12T00:00:00.000Z"),
        startedAt: utc("2026-03-05T00:00:00.000Z"),
      },
      readingStatus: "finished",
    });

    expect(view.summary.readingPeriod).toMatchObject({
      calendarDays: 8,
      endDate: "2026-03-12",
      startDate: "2026-03-05",
    });
  });

  it("counts a single-day reading period as one calendar day", () => {
    const view = buildView({
      progress: {
        finishedAt: utc("2026-03-05T00:00:00.000Z"),
        startedAt: utc("2026-03-05T00:00:00.000Z"),
      },
      readingStatus: "finished",
    });

    expect(view.summary.readingPeriod.calendarDays).toBe(1);
  });

  it("uses the earliest event as the period start when startedAt is missing", () => {
    const view = buildView({
      events: [
        event({ date: "2026-03-05", id: "e1", page: 30, pagesRead: 30 }),
        event({ date: "2026-03-08", id: "e2", page: 90, pagesRead: 60 }),
      ],
      progress: { currentPage: 90, startedAt: null },
    });

    expect(view.summary.readingPeriod.startDate).toBe("2026-03-05");
  });

  it("marks history complete when the current page matches the tracked pages", () => {
    const view = buildView({ events: multiDayEvents(), progress: { currentPage: 250 } });

    expect(view.summary.historyCompleteness).toEqual({ isComplete: true, untrackedPages: 0 });
  });

  it("reports untracked pages when the current page exceeds the tracked pages", () => {
    const view = buildView({ events: multiDayEvents(), progress: { currentPage: 300 } });

    expect(view.summary.historyCompleteness).toEqual({ isComplete: false, untrackedPages: 50 });
  });

  it("treats tracked pages above the current page as complete with no untracked pages", () => {
    const view = buildView({ events: multiDayEvents(), progress: { currentPage: 100 } });

    expect(view.summary.historyCompleteness).toEqual({ isComplete: true, untrackedPages: 0 });
  });
});

describe("toReadingHistoryView forecast", () => {
  it("estimates the remaining active days for a reading book with at least two active days", () => {
    const view = buildView({
      events: [
        event({ date: "2026-03-06", id: "e1", page: 50, pagesRead: 50 }),
        event({ date: "2026-03-08", id: "e2", page: 100, pagesRead: 50 }),
      ],
      pagesCount: 300,
      progress: { currentPage: 100 },
      readingStatus: "reading",
    });

    expect(view.summary.estimatedActiveDaysRemaining).toBe(4);
  });

  it("does not forecast when there is only one active day", () => {
    const view = buildView({
      events: [event({ date: "2026-03-08", id: "e1", page: 100, pagesRead: 100 })],
      pagesCount: 300,
      progress: { currentPage: 100 },
      readingStatus: "reading",
    });

    expect(view.summary.estimatedActiveDaysRemaining).toBeNull();
  });

  it("does not forecast for a paused book", () => {
    const view = buildView({
      events: [
        event({ date: "2026-03-06", id: "e1", page: 50, pagesRead: 50 }),
        event({ date: "2026-03-08", id: "e2", page: 100, pagesRead: 50 }),
      ],
      pagesCount: 300,
      progress: { currentPage: 100, pausedAt: utc("2026-03-10T00:00:00.000Z") },
      readingStatus: "paused",
    });

    expect(view.summary.estimatedActiveDaysRemaining).toBeNull();
  });

  it("does not forecast for a finished book", () => {
    const view = buildView({
      events: [
        event({ date: "2026-03-06", id: "e1", page: 50, pagesRead: 50 }),
        event({ date: "2026-03-08", id: "e2", page: 100, pagesRead: 50 }),
      ],
      pagesCount: 300,
      progress: { currentPage: 100, finishedAt: utc("2026-03-10T00:00:00.000Z") },
      readingStatus: "finished",
    });

    expect(view.summary.estimatedActiveDaysRemaining).toBeNull();
  });

  it("does not forecast for a book marked dnf", () => {
    const view = buildView({
      events: [
        event({ date: "2026-03-06", id: "e1", page: 50, pagesRead: 50 }),
        event({ date: "2026-03-08", id: "e2", page: 100, pagesRead: 50 }),
      ],
      pagesCount: 300,
      progress: { abandonedAt: utc("2026-03-10T00:00:00.000Z"), currentPage: 100 },
      readingStatus: "dnf",
    });

    expect(view.summary.estimatedActiveDaysRemaining).toBeNull();
  });

  it("does not forecast when the page count is unknown", () => {
    const view = buildView({
      events: [
        event({ date: "2026-03-06", id: "e1", page: 50, pagesRead: 50 }),
        event({ date: "2026-03-08", id: "e2", page: 100, pagesRead: 50 }),
      ],
      pagesCount: null,
      progress: { currentPage: 100 },
      readingStatus: "reading",
    });

    expect(view.summary.estimatedActiveDaysRemaining).toBeNull();
  });

  it("does not forecast when there are no remaining pages", () => {
    const view = buildView({
      events: [
        event({ date: "2026-03-06", id: "e1", page: 150, pagesRead: 150 }),
        event({ date: "2026-03-08", id: "e2", page: 300, pagesRead: 150 }),
      ],
      pagesCount: 300,
      progress: { currentPage: 300 },
      readingStatus: "reading",
    });

    expect(view.summary.estimatedActiveDaysRemaining).toBeNull();
  });

  it("forecasts for a rereading book the same way as a reading book", () => {
    const view = buildView({
      events: [
        event({ date: "2026-03-06", id: "e1", page: 50, pagesRead: 50 }),
        event({ date: "2026-03-08", id: "e2", page: 100, pagesRead: 50 }),
      ],
      pagesCount: 300,
      progress: { currentPage: 100 },
      readingStatus: "rereading",
    });

    expect(view.summary.estimatedActiveDaysRemaining).toBe(4);
  });
});

describe("toReadingHistoryView activity graph", () => {
  it("returns exactly seven points for the 7d range", () => {
    const view = buildView({
      events: multiDayEvents(),
      progress: { currentPage: 250 },
      query: { activityRange: "7d" },
      today: utc("2026-03-12T00:00:00.000Z"),
    });

    expect(view.activity.points).toHaveLength(7);
    expect(view.activity.from).toBe("2026-03-06");
    expect(view.activity.to).toBe("2026-03-12");
  });

  it("returns exactly fourteen points for the 14d range", () => {
    const view = buildView({
      events: multiDayEvents(),
      progress: { currentPage: 250 },
      query: { activityRange: "14d" },
      today: utc("2026-03-12T00:00:00.000Z"),
    });

    expect(view.activity.points).toHaveLength(14);
    expect(view.activity.from).toBe("2026-02-27");
    expect(view.activity.to).toBe("2026-03-12");
  });

  it("fills days without events as zero points", () => {
    const view = buildView({
      events: [
        event({ date: "2026-03-08", id: "e1", page: 60, pagesRead: 60 }),
        event({ date: "2026-03-12", id: "e2", page: 100, pagesRead: 40 }),
      ],
      progress: { currentPage: 100 },
      query: { activityRange: "7d" },
      today: utc("2026-03-12T00:00:00.000Z"),
    });

    const empty = view.activity.points.find((point) => point.date === "2026-03-07");
    const active = view.activity.points.find((point) => point.date === "2026-03-08");

    expect(empty).toEqual({
      date: "2026-03-07",
      finalPage: null,
      hasActivity: false,
      pagesRead: 0,
      startPage: null,
      updatesCount: 0,
    });
    expect(active).toMatchObject({ finalPage: 60, hasActivity: true, pagesRead: 60, startPage: 0 });
  });

  it("keeps activity points in ascending date order even when the history sort is desc", () => {
    const view = buildView({
      events: multiDayEvents(),
      progress: { currentPage: 250 },
      query: { activityRange: "7d", sort: "desc" },
      today: utc("2026-03-12T00:00:00.000Z"),
    });

    const dates = view.activity.points.map((point) => point.date);

    expect(dates).toEqual([...dates].sort());
  });

  it("computes the activity summary only from points inside the selected range", () => {
    const view = buildView({
      events: [
        event({ date: "2026-03-01", id: "old", page: 100, pagesRead: 100 }),
        event({ date: "2026-03-08", id: "recent", page: 150, pagesRead: 50 }),
      ],
      progress: { currentPage: 150 },
      query: { activityRange: "7d" },
      today: utc("2026-03-12T00:00:00.000Z"),
    });

    expect(view.activity.summary).toMatchObject({
      activeDaysCount: 1,
      pagesRead: 50,
      updatesCount: 1,
    });
    expect(view.summary.trackedPagesRead).toBe(150);
  });

  it("returns the whole reading period for the all range", () => {
    const view = buildView({
      events: multiDayEvents(),
      progress: { currentPage: 250, startedAt: utc("2026-03-05T00:00:00.000Z") },
      query: { activityRange: "all" },
      today: utc("2026-03-12T00:00:00.000Z"),
    });

    expect(view.activity.from).toBe("2026-03-05");
    expect(view.activity.to).toBe("2026-03-12");
    expect(view.activity.points).toHaveLength(8);
  });

  it("returns an empty activity graph for the all range without dates or events", () => {
    const view = buildView({
      events: [],
      progress: { currentPage: 0, startedAt: null },
      query: { activityRange: "all" },
      readingStatus: "not_started",
    });

    expect(view.activity.from).toBeNull();
    expect(view.activity.to).toBeNull();
    expect(view.activity.points).toEqual([]);
  });

  it("anchors the 7d range on today for a reading book", () => {
    const view = buildView({
      events: [event({ date: "2026-03-05", id: "e1", page: 60, pagesRead: 60 })],
      progress: { currentPage: 60 },
      query: { activityRange: "7d" },
      readingStatus: "reading",
      today: utc("2026-03-12T00:00:00.000Z"),
    });

    expect(view.activity.to).toBe("2026-03-12");
  });

  it("anchors the 7d range on the finished date for a finished book", () => {
    const view = buildView({
      progress: { finishedAt: utc("2026-03-10T00:00:00.000Z") },
      query: { activityRange: "7d" },
      readingStatus: "finished",
      today: utc("2026-03-20T00:00:00.000Z"),
    });

    expect(view.activity.to).toBe("2026-03-10");
    expect(view.activity.from).toBe("2026-03-04");
  });

  it("anchors the 7d range on the paused date for a paused book", () => {
    const view = buildView({
      progress: { pausedAt: utc("2026-03-10T00:00:00.000Z") },
      query: { activityRange: "7d" },
      readingStatus: "paused",
      today: utc("2026-03-20T00:00:00.000Z"),
    });

    expect(view.activity.to).toBe("2026-03-10");
  });

  it("anchors the 7d range on the abandoned date for a dnf book", () => {
    const view = buildView({
      progress: { abandonedAt: utc("2026-03-10T00:00:00.000Z") },
      query: { activityRange: "7d" },
      readingStatus: "dnf",
      today: utc("2026-03-20T00:00:00.000Z"),
    });

    expect(view.activity.to).toBe("2026-03-10");
  });

  it("groups events by UTC calendar day at the day boundary", () => {
    const events: ReadingEventRow[] = [
      {
        createdAt: utc("2026-07-14T23:59:00.000Z"),
        date: utc("2026-07-14T23:59:00.000Z"),
        id: "late",
        page: 50,
        pagesRead: 50,
      },
      {
        createdAt: utc("2026-07-15T00:01:00.000Z"),
        date: utc("2026-07-15T00:01:00.000Z"),
        id: "early",
        page: 90,
        pagesRead: 40,
      },
    ];
    const view = buildView({
      events,
      progress: { currentPage: 90 },
      query: { activityRange: "7d", sort: "asc" },
      today: utc("2026-07-14T23:59:00.000Z"),
    });

    expect(view.history.days.map((day) => day.date)).toEqual(["2026-07-14", "2026-07-15"]);
    expect(view.activity.to).toBe("2026-07-14");
    expect(view.activity.from).toBe("2026-07-08");
  });
});

describe("toReadingHistoryView history grouping", () => {
  it("returns history already grouped by calendar day", () => {
    const view = buildView({
      events: [
        event({ date: "2026-03-08", id: "e1", page: 60, pagesRead: 60 }),
        event({ date: "2026-03-12", id: "e2", page: 100, pagesRead: 40 }),
      ],
      progress: { currentPage: 100 },
    });

    expect(view.history.days).toHaveLength(2);
    expect(view.history.days.every((day) => Array.isArray(day.events))).toBe(true);
  });

  it("derives the day start and final pages from the first and last chronological events", () => {
    const view = buildView({
      events: threeEventDay(),
      progress: { currentPage: 250 },
      query: { sort: "asc" },
    });

    expect(view.history.days[0]).toMatchObject({ finalPage: 250, startPage: 215 });
  });

  it("counts the day updates from the number of events", () => {
    const view = buildView({ events: threeEventDay(), progress: { currentPage: 250 } });

    expect(firstDay(view).updatesCount).toBe(3);
  });

  it("sums the day pages read from the event pages read", () => {
    const view = buildView({ events: threeEventDay(), progress: { currentPage: 250 } });

    expect(firstDay(view).pagesRead).toBe(35);
  });

  it("returns the technical recorded timestamp of each event", () => {
    const view = buildView({
      events: threeEventDay(),
      progress: { currentPage: 250 },
      query: { sort: "asc" },
    });

    expect(firstEvent(firstDay(view)).recordedAt).toBe("2026-03-12T10:20:00.000Z");
  });

  it("orders days newest first and intra-day events last first when sorted desc", () => {
    const view = buildView({
      events: multiDayEvents(),
      progress: { currentPage: 250 },
      query: { sort: "desc" },
    });

    expect(firstDay(view).date).toBe("2026-03-12");
    const march8 = view.history.days.find((day) => day.date === "2026-03-08");
    expect(march8?.events.at(0)?.page).toBe(215);
  });

  it("orders days oldest first and intra-day events first last when sorted asc", () => {
    const view = buildView({
      events: multiDayEvents(),
      progress: { currentPage: 250 },
      query: { sort: "asc" },
    });

    expect(firstDay(view).date).toBe("2026-03-05");
    const march8 = view.history.days.find((day) => day.date === "2026-03-08");
    expect(march8?.events.at(0)?.page).toBe(150);
  });

  it("orders events with an identical timestamp by their stable identifier", () => {
    const view = buildView({
      events: [
        event({
          createdAt: "2026-03-08T12:00:00.000Z",
          date: "2026-03-08",
          id: "aaa",
          page: 30,
          pagesRead: 30,
        }),
        event({
          createdAt: "2026-03-08T12:00:00.000Z",
          date: "2026-03-08",
          id: "bbb",
          page: 50,
          pagesRead: 20,
        }),
      ],
      progress: { currentPage: 50 },
      query: { sort: "asc" },
    });

    expect(firstDay(view).events.map((entry) => entry.id)).toEqual(["aaa", "bbb"]);
  });

  it("paginates the history over grouped days", () => {
    const view = buildView({
      events: [
        event({ date: "2026-03-05", id: "e1", page: 20, pagesRead: 20 }),
        event({ date: "2026-03-06", id: "e2", page: 40, pagesRead: 20 }),
        event({ date: "2026-03-07", id: "e3", page: 60, pagesRead: 20 }),
        event({ date: "2026-03-08", id: "e4", page: 80, pagesRead: 20 }),
        event({ date: "2026-03-09", id: "e5", page: 100, pagesRead: 20 }),
      ],
      progress: { currentPage: 100 },
      query: { limit: 2, page: 2, sort: "asc" },
    });

    expect(view.history.days).toHaveLength(2);
    expect(view.history.days.map((day) => day.date)).toEqual(["2026-03-07", "2026-03-08"]);
    expect(view.history.pagination).toMatchObject({
      hasNextPage: true,
      hasPreviousPage: true,
      totalDays: 5,
      totalPages: 3,
    });
  });

  it("keeps all events of a day together on a single page", () => {
    const view = buildView({
      events: [
        ...threeEventDay(),
        event({ date: "2026-03-13", id: "next", page: 300, pagesRead: 50 }),
      ],
      progress: { currentPage: 300 },
      query: { limit: 1, page: 1, sort: "asc" },
    });

    expect(view.history.days).toHaveLength(1);
    expect(firstDay(view).date).toBe("2026-03-12");
    expect(firstDay(view).events).toHaveLength(3);
  });

  it("returns empty days for a page beyond the available history", () => {
    const view = buildView({
      events: [
        event({ date: "2026-03-05", id: "e1", page: 20, pagesRead: 20 }),
        event({ date: "2026-03-06", id: "e2", page: 40, pagesRead: 20 }),
        event({ date: "2026-03-07", id: "e3", page: 60, pagesRead: 20 }),
      ],
      progress: { currentPage: 60 },
      query: { limit: 20, page: 99 },
    });

    expect(view.history.days).toEqual([]);
    expect(view.history.pagination).toMatchObject({
      hasNextPage: false,
      hasPreviousPage: true,
      totalDays: 3,
    });
  });
});

describe("toReadingHistoryView activity graph across a DST transition", () => {
  const originalTimezone = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = "Europe/Kyiv";
  });

  afterEach(() => {
    process.env.TZ = originalTimezone;
  });

  it("emits seven consecutive UTC days when the 7d window straddles the spring-forward boundary", () => {
    const view = buildView({
      events: [event({ date: "2026-03-27", id: "e1", page: 60, pagesRead: 60 })],
      progress: { currentPage: 60 },
      query: { activityRange: "7d" },
      readingStatus: "reading",
      today: utc("2026-03-31T00:00:00.000Z"),
    });

    expect(view.activity.points.map((point) => point.date)).toEqual([
      "2026-03-25",
      "2026-03-26",
      "2026-03-27",
      "2026-03-28",
      "2026-03-29",
      "2026-03-30",
      "2026-03-31",
    ]);
    expect(view.activity.from).toBe("2026-03-25");
    expect(view.activity.to).toBe("2026-03-31");
  });

  it("emits fourteen consecutive UTC days when the 14d window straddles the spring-forward boundary", () => {
    const view = buildView({
      events: [event({ date: "2026-03-27", id: "e1", page: 60, pagesRead: 60 })],
      progress: { currentPage: 60 },
      query: { activityRange: "14d" },
      readingStatus: "reading",
      today: utc("2026-03-31T00:00:00.000Z"),
    });

    expect(view.activity.points.map((point) => point.date)).toEqual([
      "2026-03-18",
      "2026-03-19",
      "2026-03-20",
      "2026-03-21",
      "2026-03-22",
      "2026-03-23",
      "2026-03-24",
      "2026-03-25",
      "2026-03-26",
      "2026-03-27",
      "2026-03-28",
      "2026-03-29",
      "2026-03-30",
      "2026-03-31",
    ]);
  });
});

describe("toReadingHistoryView all-range safety cap", () => {
  it("clamps the all range to the maximum span for a far-past start, ending on the anchor", () => {
    const view = buildView({
      events: [],
      progress: { currentPage: 40, startedAt: utc("1990-01-01T00:00:00.000Z") },
      query: { activityRange: "all" },
      readingStatus: "reading",
      today: utc("2026-03-12T00:00:00.000Z"),
    });

    const dates = view.activity.points.map((point) => point.date);

    expect(view.activity.points).toHaveLength(READING_ACTIVITY_ALL_MAX_DAYS);
    expect(view.activity.to).toBe("2026-03-12");
    expect(dates.at(-1)).toBe("2026-03-12");
    expect(view.activity.from).toBe(dates.at(0));
    expect(new Set(dates).size).toBe(dates.length);
    expect(dates).toEqual([...dates].sort());
    expect(view.summary.readingPeriod.startDate).toBe("1990-01-01");
  });

  it("leaves an all range within the cap as the full reading period", () => {
    const view = buildView({
      events: [
        event({ date: "2026-01-01", id: "e1", page: 20, pagesRead: 20 }),
        event({ date: "2026-03-10", id: "e2", page: 120, pagesRead: 100 }),
      ],
      progress: { currentPage: 120, startedAt: utc("2026-01-01T00:00:00.000Z") },
      query: { activityRange: "all" },
      readingStatus: "reading",
      today: utc("2026-03-12T00:00:00.000Z"),
    });

    expect(view.activity.from).toBe("2026-01-01");
    expect(view.activity.to).toBe("2026-03-12");
    expect(view.activity.points).toHaveLength(71);
  });
});
