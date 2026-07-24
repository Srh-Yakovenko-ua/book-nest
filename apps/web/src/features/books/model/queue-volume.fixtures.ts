import type { ReadingQueueVolumeSummaryView } from "@app/shared";

export function makeQueueVolumeSummary(
  overrides: Partial<ReadingQueueVolumeSummaryView> = {},
): ReadingQueueVolumeSummaryView {
  return {
    audiobookOnlyCount: 0,
    coverage: { calculatedBooks: 0, ratio: 0, totalBooks: 0 },
    estimate: {
      daysMax: null,
      daysMin: null,
      daysUntilForecast: null,
      reasonUnavailable: "empty_queue",
    },
    hasMissingData: false,
    pace: {
      activeDaysInPeriod: 0,
      lastActivityAt: null,
      pagesPerCalendarDay: null,
      sourcePeriodDays: 0,
    },
    pages: { invalidBooks: 0, knownRemaining: 0, missingBooks: 0 },
    queueBooksCount: 0,
    ...overrides,
  };
}
