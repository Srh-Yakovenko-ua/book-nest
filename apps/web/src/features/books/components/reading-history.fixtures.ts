import type {
  ReadingActivityView,
  ReadingHistoryDayView,
  ReadingHistoryEventView,
  ReadingHistoryPaginationView,
  ReadingHistorySummaryView,
  ReadingHistoryView,
} from "@app/shared";

type ReadingHistoryViewOverrides = {
  activity?: Partial<ReadingActivityView>;
  days?: ReadingHistoryDayView[];
  pagination?: Partial<ReadingHistoryPaginationView>;
  summary?: Partial<ReadingHistorySummaryView>;
};

export function makeReadingActivity(
  overrides: Partial<ReadingActivityView> = {},
): ReadingActivityView {
  return {
    from: "2026-03-06",
    points: [
      {
        date: "2026-03-11",
        finalPage: null,
        hasActivity: false,
        pagesRead: 0,
        startPage: null,
        updatesCount: 0,
      },
      {
        date: "2026-03-12",
        finalPage: 250,
        hasActivity: true,
        pagesRead: 35,
        startPage: 215,
        updatesCount: 3,
      },
    ],
    range: "7d",
    summary: {
      activeDaysCount: 3,
      averagePagesPerActiveDay: 55.7,
      bestDay: null,
      pagesRead: 167,
      updatesCount: 5,
    },
    to: "2026-03-12",
    ...overrides,
  };
}

export function makeReadingDay(overrides: Partial<ReadingHistoryDayView> = {}): ReadingHistoryDayView {
  return {
    date: "2026-03-12",
    events: [makeReadingEvent()],
    finalPage: 250,
    pagesRead: 35,
    startPage: 215,
    updatesCount: 3,
    ...overrides,
  };
}

export function makeReadingEvent(
  overrides: Partial<ReadingHistoryEventView> = {},
): ReadingHistoryEventView {
  return {
    date: "2026-03-12",
    id: "event-1",
    page: 225,
    pagesRead: 10,
    recordedAt: "2026-03-12T10:20:00.000Z",
    ...overrides,
  };
}

export function makeReadingHistoryView(
  overrides: ReadingHistoryViewOverrides = {},
): ReadingHistoryView {
  return {
    activity: makeReadingActivity(overrides.activity),
    history: {
      days: overrides.days ?? [makeReadingDay()],
      pagination: makeReadingPagination(overrides.pagination),
    },
    summary: makeReadingSummary(overrides.summary),
  };
}

export function makeReadingPagination(
  overrides: Partial<ReadingHistoryPaginationView> = {},
): ReadingHistoryPaginationView {
  return {
    hasNextPage: false,
    hasPreviousPage: false,
    limit: 20,
    page: 1,
    totalDays: 1,
    totalPages: 1,
    ...overrides,
  };
}

export function makeReadingSummary(
  overrides: Partial<ReadingHistorySummaryView> = {},
): ReadingHistorySummaryView {
  return {
    abandonedAt: null,
    activeDaysCount: 6,
    averagePagesPerActiveDay: 42,
    bestDay: { date: "2026-03-10", finalPage: 200, pagesRead: 84, updatesCount: 2 },
    currentPage: 250,
    estimatedActiveDaysRemaining: null,
    finishedAt: null,
    historyCompleteness: { isComplete: true, untrackedPages: 0 },
    lastActivity: null,
    lastProgressUpdateAt: "2026-03-12",
    pagesCount: 320,
    pagesRemaining: 70,
    pausedAt: null,
    progressPercent: 78,
    readingPeriod: { calendarDays: null, endDate: null, startDate: "2026-03-01" },
    startedAt: "2026-03-01",
    status: "reading",
    trackedPagesRead: 167,
    updatesCount: 5,
    ...overrides,
  };
}
