import type {
  Nullable,
  ReadingQueueVolumeSummaryView,
  ReadingQueueVolumeUnavailableReason,
  ReadingStatus,
} from "@app/shared";

import { isClosedReadingStatus, ReadingStatusSchema } from "@app/shared";
import { differenceInCalendarDays } from "date-fns";

import { toNullableIsoDate } from "../../../core/iso-date.js";
import { readingStatusUsesProgress } from "../../books/index.js";

export const PACE_WINDOW_DAYS = 90;
export const MIN_HISTORY_DAYS = 30;
export const MIN_ACTIVE_DAYS = 5;
export const MIN_PAGES_IN_PERIOD = 300;
export const STALE_ACTIVITY_DAYS = 21;
export const MIN_COVERAGE_RATIO = 0.7;
export const ESTIMATE_SPREAD = 0.15;

const AUDIOBOOK_FORMAT = "audiobook";

export type QueueVolumePaceRow = {
  activeDaysInPeriod: number;
  firstEventDate: Nullable<Date>;
  lastEventDate: Nullable<Date>;
  pagesReadInPeriod: number;
};

export type QueueVolumeRow = {
  formats: string[];
  pagesCount: Nullable<number>;
  pagesCountUnavailable: boolean;
  readingProgress: Nullable<{ currentPage: Nullable<number> }>;
  readingStatus: string;
};

export type VolumeReasonInput = {
  activeDaysInPeriod: number;
  coverageRatio: number;
  coverageTotalBooks: number;
  historyDays: number;
  lastEventDate: Nullable<Date>;
  pagesPerCalendarDay: Nullable<number>;
  pagesReadInPeriod: number;
  queueBooksCount: number;
  today: Date;
};

export type VolumeReasonResult = {
  daysUntilForecast: Nullable<number>;
  reasonUnavailable: Nullable<ReadingQueueVolumeUnavailableReason>;
};

type RowCategory =
  | { kind: "audiobookOnly" }
  | { kind: "calculated"; remaining: number }
  | { kind: "invalid" }
  | { kind: "missing" }
  | { kind: "unavailable" };

type ScopeTotals = {
  audiobookOnly: number;
  calculated: number;
  invalid: number;
  knownRemaining: number;
  missing: number;
  unavailable: number;
};

export function computeQueueVolume(input: {
  paceRow: QueueVolumePaceRow;
  rows: readonly QueueVolumeRow[];
  today: Date;
}): ReadingQueueVolumeSummaryView {
  const { paceRow, rows, today } = input;

  const totals = accumulateScope(rows);

  const queueBooksCount =
    totals.calculated + totals.invalid + totals.missing + totals.audiobookOnly + totals.unavailable;
  const coverageTotalBooks = totals.calculated + totals.invalid + totals.missing;
  const coverageRatio = coverageTotalBooks === 0 ? 0 : totals.calculated / coverageTotalBooks;

  const historyDays =
    paceRow.firstEventDate === null
      ? 0
      : Math.min(PACE_WINDOW_DAYS, differenceInCalendarDays(today, paceRow.firstEventDate) + 1);
  const pagesPerCalendarDay = historyDays === 0 ? null : paceRow.pagesReadInPeriod / historyDays;

  const reason = resolveVolumeReason({
    activeDaysInPeriod: paceRow.activeDaysInPeriod,
    coverageRatio,
    coverageTotalBooks,
    historyDays,
    lastEventDate: paceRow.lastEventDate,
    pagesPerCalendarDay,
    pagesReadInPeriod: paceRow.pagesReadInPeriod,
    queueBooksCount,
    today,
  });

  const estimate =
    reason.reasonUnavailable === null
      ? computeEstimate({ knownRemaining: totals.knownRemaining, pagesPerCalendarDay })
      : { daysMax: null, daysMin: null };

  return {
    audiobookOnlyCount: totals.audiobookOnly,
    coverage: {
      calculatedBooks: totals.calculated,
      ratio: coverageRatio,
      totalBooks: coverageTotalBooks,
    },
    estimate: {
      daysMax: estimate.daysMax,
      daysMin: estimate.daysMin,
      daysUntilForecast: reason.daysUntilForecast,
      reasonUnavailable: reason.reasonUnavailable,
    },
    hasMissingData: totals.missing > 0 || totals.invalid > 0,
    pace: {
      activeDaysInPeriod: paceRow.activeDaysInPeriod,
      lastActivityAt: toNullableIsoDate(paceRow.lastEventDate),
      pagesPerCalendarDay,
      sourcePeriodDays: historyDays,
    },
    pages: {
      invalidBooks: totals.invalid,
      knownRemaining: totals.knownRemaining,
      missingBooks: totals.missing,
    },
    queueBooksCount,
  };
}

export function resolveVolumeReason(input: VolumeReasonInput): VolumeReasonResult {
  if (input.queueBooksCount === 0) {
    return { daysUntilForecast: null, reasonUnavailable: "empty_queue" };
  }
  if (input.coverageTotalBooks === 0) {
    return { daysUntilForecast: null, reasonUnavailable: "no_volume_data" };
  }
  if (input.coverageRatio < MIN_COVERAGE_RATIO) {
    return { daysUntilForecast: null, reasonUnavailable: "insufficient_coverage" };
  }
  if (input.historyDays < MIN_HISTORY_DAYS) {
    return {
      daysUntilForecast: MIN_HISTORY_DAYS - input.historyDays,
      reasonUnavailable: "insufficient_history",
    };
  }
  if (input.activeDaysInPeriod < MIN_ACTIVE_DAYS || input.pagesReadInPeriod < MIN_PAGES_IN_PERIOD) {
    return { daysUntilForecast: null, reasonUnavailable: "insufficient_history" };
  }
  if (
    input.lastEventDate !== null &&
    differenceInCalendarDays(input.today, input.lastEventDate) > STALE_ACTIVITY_DAYS
  ) {
    return { daysUntilForecast: null, reasonUnavailable: "stale_activity" };
  }
  if (input.pagesPerCalendarDay === 0) {
    return { daysUntilForecast: null, reasonUnavailable: "zero_pace" };
  }
  return { daysUntilForecast: null, reasonUnavailable: null };
}

function accumulateScope(rows: readonly QueueVolumeRow[]): ScopeTotals {
  const totals: ScopeTotals = {
    audiobookOnly: 0,
    calculated: 0,
    invalid: 0,
    knownRemaining: 0,
    missing: 0,
    unavailable: 0,
  };

  for (const row of rows) {
    const status = ReadingStatusSchema.parse(row.readingStatus);
    if (isClosedReadingStatus(status)) {
      continue;
    }

    const category = classifyRow(row, status);
    switch (category.kind) {
      case "audiobookOnly":
        totals.audiobookOnly += 1;
        break;
      case "calculated":
        totals.calculated += 1;
        totals.knownRemaining += category.remaining;
        break;
      case "invalid":
        totals.invalid += 1;
        break;
      case "missing":
        totals.missing += 1;
        break;
      case "unavailable":
        totals.unavailable += 1;
        break;
      default:
        assertNever(category);
    }
  }

  return totals;
}

function assertNever(value: never): never {
  throw new Error(`unreachable queue-volume category: ${JSON.stringify(value)}`);
}

function classifyRow(row: QueueVolumeRow, status: ReadingStatus): RowCategory {
  const normalizedCurrentPage = readingStatusUsesProgress(status)
    ? (row.readingProgress?.currentPage ?? 0)
    : 0;

  if (row.pagesCount !== null) {
    if (normalizedCurrentPage > row.pagesCount) {
      return { kind: "invalid" };
    }
    return { kind: "calculated", remaining: Math.max(0, row.pagesCount - normalizedCurrentPage) };
  }

  if (row.pagesCountUnavailable) {
    return { kind: "unavailable" };
  }

  if (isAudiobookOnly(row.formats)) {
    return { kind: "audiobookOnly" };
  }

  return { kind: "missing" };
}

function computeEstimate(input: {
  knownRemaining: number;
  pagesPerCalendarDay: Nullable<number>;
}): { daysMax: Nullable<number>; daysMin: Nullable<number> } {
  if (
    input.pagesPerCalendarDay === null ||
    input.pagesPerCalendarDay <= 0 ||
    input.knownRemaining <= 0
  ) {
    return { daysMax: null, daysMin: null };
  }

  const estimatedDays = input.knownRemaining / input.pagesPerCalendarDay;
  return {
    daysMax: Math.ceil(estimatedDays * (1 + ESTIMATE_SPREAD)),
    daysMin: Math.ceil(estimatedDays * (1 - ESTIMATE_SPREAD)),
  };
}

function isAudiobookOnly(formats: string[]): boolean {
  return formats.length === 1 && formats[0] === AUDIOBOOK_FORMAT;
}
