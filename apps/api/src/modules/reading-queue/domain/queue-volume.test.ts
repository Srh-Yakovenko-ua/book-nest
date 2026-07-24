import { subDays } from "date-fns";
import { describe, expect, it } from "vitest";

import type { QueueVolumePaceRow, QueueVolumeRow, VolumeReasonInput } from "./queue-volume.js";

import {
  computeQueueVolume,
  MIN_HISTORY_DAYS,
  PACE_WINDOW_DAYS,
  resolveVolumeReason,
} from "./queue-volume.js";

const TODAY = new Date("2026-07-22T12:00:00.000Z");

function compute(rows: QueueVolumeRow[], paceRow: QueueVolumePaceRow = pace()) {
  return computeQueueVolume({ paceRow, rows, today: TODAY });
}

function pace(overrides: Partial<QueueVolumePaceRow> = {}): QueueVolumePaceRow {
  return {
    activeDaysInPeriod: 0,
    firstEventDate: null,
    lastEventDate: null,
    pagesReadInPeriod: 0,
    ...overrides,
  };
}

function reasonInput(overrides: Partial<VolumeReasonInput> = {}): VolumeReasonInput {
  return {
    activeDaysInPeriod: 10,
    coverageRatio: 1,
    coverageTotalBooks: 5,
    historyDays: 40,
    lastEventDate: subDays(TODAY, 1),
    pagesPerCalendarDay: 12.5,
    pagesReadInPeriod: 500,
    queueBooksCount: 5,
    today: TODAY,
    ...overrides,
  };
}

function row(overrides: Partial<QueueVolumeRow> = {}): QueueVolumeRow {
  return {
    formats: [],
    pagesCount: null,
    pagesCountUnavailable: false,
    readingProgress: null,
    readingStatus: "want_to_read",
    ...overrides,
  };
}

describe("computeQueueVolume classification and coverage", () => {
  it("returns all zeros and empty_queue for an empty queue", () => {
    const result = compute([]);

    expect(result.queueBooksCount).toBe(0);
    expect(result.coverage).toEqual({ calculatedBooks: 0, ratio: 0, totalBooks: 0 });
    expect(result.pages).toEqual({ invalidBooks: 0, knownRemaining: 0, missingBooks: 0 });
    expect(result.audiobookOnlyCount).toBe(0);
    expect(result.hasMissingData).toBe(false);
    expect(result.estimate).toEqual({
      daysMax: null,
      daysMin: null,
      daysUntilForecast: null,
      reasonUnavailable: "empty_queue",
    });
    expect(result.pace).toEqual({
      activeDaysInPeriod: 0,
      lastActivityAt: null,
      pagesPerCalendarDay: null,
      sourcePeriodDays: 0,
    });
  });

  it("computes ratio 1 and an exact remaining when every book has a page count", () => {
    const result = compute([row({ pagesCount: 100 }), row({ pagesCount: 200 })]);

    expect(result.coverage).toEqual({ calculatedBooks: 2, ratio: 1, totalBooks: 2 });
    expect(result.pages.knownRemaining).toBe(300);
  });

  it("subtracts the current page for a status that tracks progress", () => {
    const result = compute([
      row({ pagesCount: 100, readingProgress: { currentPage: 30 }, readingStatus: "reading" }),
    ]);

    expect(result.pages.knownRemaining).toBe(70);
    expect(result.coverage.calculatedBooks).toBe(1);
  });

  it("does not subtract residual progress for want_to_read", () => {
    const result = compute([
      row({ pagesCount: 100, readingProgress: { currentPage: 30 }, readingStatus: "want_to_read" }),
    ]);

    expect(result.pages.knownRemaining).toBe(100);
  });

  it("marks a book as invalid when the current page exceeds the page count", () => {
    const result = compute([
      row({ pagesCount: 200, readingProgress: { currentPage: 300 }, readingStatus: "reading" }),
    ]);

    expect(result.pages.invalidBooks).toBe(1);
    expect(result.pages.knownRemaining).toBe(0);
    expect(result.coverage).toEqual({ calculatedBooks: 0, ratio: 0, totalBooks: 1 });
  });

  it("counts a fully read book inside coverage with a zero remaining", () => {
    const result = compute([
      row({ pagesCount: 100, readingProgress: { currentPage: 100 }, readingStatus: "reading" }),
    ]);

    expect(result.coverage.calculatedBooks).toBe(1);
    expect(result.pages.knownRemaining).toBe(0);
    expect(result.pages.invalidBooks).toBe(0);
  });

  it("keeps a pages-unavailable book out of both coverage numerator and denominator", () => {
    const result = compute([row({ pagesCount: 100 }), row({ pagesCountUnavailable: true })]);

    expect(result.coverage).toEqual({ calculatedBooks: 1, ratio: 1, totalBooks: 1 });
    expect(result.queueBooksCount).toBe(2);
  });

  it("counts an audiobook-only book without pages outside the denominator", () => {
    const result = compute([row({ pagesCount: 100 }), row({ formats: ["audiobook"] })]);

    expect(result.audiobookOnlyCount).toBe(1);
    expect(result.coverage).toEqual({ calculatedBooks: 1, ratio: 1, totalBooks: 1 });
    expect(result.queueBooksCount).toBe(2);
  });

  it("treats a mixed-format book without pages as missing", () => {
    const result = compute([row({ formats: ["audiobook", "paper"] })]);

    expect(result.pages.missingBooks).toBe(1);
    expect(result.audiobookOnlyCount).toBe(0);
  });

  it("treats a book without formats and without pages as missing", () => {
    const result = compute([row({ formats: [] })]);

    expect(result.pages.missingBooks).toBe(1);
  });

  it("counts an audiobook-only book that has pages as calculated", () => {
    const result = compute([row({ formats: ["audiobook"], pagesCount: 100 })]);

    expect(result.coverage.calculatedBooks).toBe(1);
    expect(result.audiobookOnlyCount).toBe(0);
    expect(result.pages.knownRemaining).toBe(100);
  });

  it("excludes finished and dnf books from every counter", () => {
    const result = compute([
      row({ pagesCount: 100, readingStatus: "finished" }),
      row({ pagesCount: 50, readingStatus: "dnf" }),
      row({ pagesCount: 200, readingStatus: "want_to_read" }),
    ]);

    expect(result.queueBooksCount).toBe(1);
    expect(result.coverage.calculatedBooks).toBe(1);
    expect(result.pages.knownRemaining).toBe(200);
    expect(result.audiobookOnlyCount).toBe(0);
  });

  it("keeps the scope invariant across a mixed set", () => {
    const result = compute([
      row({ pagesCount: 100 }),
      row({ pagesCount: 100, readingProgress: { currentPage: 150 }, readingStatus: "reading" }),
      row({ formats: ["paper"] }),
      row({ formats: ["audiobook"] }),
      row({ pagesCountUnavailable: true }),
      row({ pagesCount: 100, readingStatus: "finished" }),
    ]);

    expect(result.queueBooksCount).toBe(5);
    expect(result.coverage.calculatedBooks).toBe(1);
    expect(result.pages.invalidBooks).toBe(1);
    expect(result.pages.missingBooks).toBe(1);
    expect(result.audiobookOnlyCount).toBe(1);

    const derivedUnavailable =
      result.queueBooksCount -
      result.coverage.calculatedBooks -
      result.pages.invalidBooks -
      result.pages.missingBooks -
      result.audiobookOnlyCount;
    expect(derivedUnavailable).toBe(1);
  });
});

describe("resolveVolumeReason priority ladder", () => {
  it("row 1: empty queue wins", () => {
    expect(resolveVolumeReason(reasonInput({ queueBooksCount: 0 }))).toEqual({
      daysUntilForecast: null,
      reasonUnavailable: "empty_queue",
    });
  });

  it("row 2: no coverage denominator", () => {
    expect(resolveVolumeReason(reasonInput({ coverageTotalBooks: 0 }))).toEqual({
      daysUntilForecast: null,
      reasonUnavailable: "no_volume_data",
    });
  });

  it("row 3: coverage below the threshold", () => {
    expect(resolveVolumeReason(reasonInput({ coverageRatio: 0.69 }))).toEqual({
      daysUntilForecast: null,
      reasonUnavailable: "insufficient_coverage",
    });
  });

  it("row 4: too few calendar days carries a wait estimate", () => {
    expect(resolveVolumeReason(reasonInput({ historyDays: 11 }))).toEqual({
      daysUntilForecast: MIN_HISTORY_DAYS - 11,
      reasonUnavailable: "insufficient_history",
    });
  });

  it("row 5: too few active days has no wait estimate", () => {
    expect(resolveVolumeReason(reasonInput({ activeDaysInPeriod: 2, historyDays: 40 }))).toEqual({
      daysUntilForecast: null,
      reasonUnavailable: "insufficient_history",
    });
  });

  it("row 5: too few pages in the period has no wait estimate", () => {
    expect(resolveVolumeReason(reasonInput({ historyDays: 40, pagesReadInPeriod: 100 }))).toEqual({
      daysUntilForecast: null,
      reasonUnavailable: "insufficient_history",
    });
  });

  it("row 6: stale last activity", () => {
    expect(resolveVolumeReason(reasonInput({ lastEventDate: subDays(TODAY, 30) }))).toEqual({
      daysUntilForecast: null,
      reasonUnavailable: "stale_activity",
    });
  });

  it("row 7: zero pace is a division-by-zero guard", () => {
    expect(resolveVolumeReason(reasonInput({ pagesPerCalendarDay: 0 }))).toEqual({
      daysUntilForecast: null,
      reasonUnavailable: "zero_pace",
    });
  });

  it("row 8: no obstacle leaves the forecast available", () => {
    expect(resolveVolumeReason(reasonInput())).toEqual({
      daysUntilForecast: null,
      reasonUnavailable: null,
    });
  });

  it("coverage outranks history when both fail", () => {
    expect(resolveVolumeReason(reasonInput({ coverageRatio: 0.69, historyDays: 11 }))).toEqual({
      daysUntilForecast: null,
      reasonUnavailable: "insufficient_coverage",
    });
  });
});

describe("computeQueueVolume estimate", () => {
  it("keeps daysUntilForecast at 19 for 11 days of history", () => {
    const result = compute(
      [row({ pagesCount: 100 })],
      pace({ firstEventDate: subDays(TODAY, 10), lastEventDate: subDays(TODAY, 1) }),
    );

    expect(result.pace.sourcePeriodDays).toBe(11);
    expect(result.estimate.reasonUnavailable).toBe("insufficient_history");
    expect(result.estimate.daysUntilForecast).toBe(19);
    expect(result.estimate.daysMin).toBeNull();
  });

  it("gives no wait estimate for enough calendar days but too few active days", () => {
    const result = compute(
      [row({ pagesCount: 100 })],
      pace({
        activeDaysInPeriod: 2,
        firstEventDate: subDays(TODAY, 39),
        lastEventDate: subDays(TODAY, 1),
        pagesReadInPeriod: 500,
      }),
    );

    expect(result.pace.sourcePeriodDays).toBe(40);
    expect(result.estimate.reasonUnavailable).toBe("insufficient_history");
    expect(result.estimate.daysUntilForecast).toBeNull();
  });

  it("yields null estimates and no NaN when the pace is zero", () => {
    const result = compute(
      [row({ pagesCount: 100 })],
      pace({
        activeDaysInPeriod: 10,
        firstEventDate: subDays(TODAY, 40),
        lastEventDate: subDays(TODAY, 1),
        pagesReadInPeriod: 0,
      }),
    );

    expect(result.pace.pagesPerCalendarDay).toBe(0);
    expect(result.estimate.daysMin).toBeNull();
    expect(result.estimate.daysMax).toBeNull();
    expect(Number.isNaN(result.estimate.daysMin ?? 0)).toBe(false);
  });

  it("produces an ascending positive-integer window with sufficient data", () => {
    const result = compute(
      [row({ pagesCount: 200 }), row({ pagesCount: 200 }), row({ pagesCount: 200 })],
      pace({
        activeDaysInPeriod: 20,
        firstEventDate: subDays(TODAY, 60),
        lastEventDate: subDays(TODAY, 1),
        pagesReadInPeriod: 600,
      }),
    );

    expect(result.estimate.reasonUnavailable).toBeNull();
    expect(result.estimate.daysUntilForecast).toBeNull();
    expect(result.estimate.daysMin).not.toBeNull();
    expect(result.estimate.daysMax).not.toBeNull();
    const daysMin = result.estimate.daysMin ?? 0;
    const daysMax = result.estimate.daysMax ?? 0;
    expect(Number.isInteger(daysMin)).toBe(true);
    expect(Number.isInteger(daysMax)).toBe(true);
    expect(daysMin).toBeGreaterThan(0);
    expect(daysMax).toBeGreaterThan(daysMin);
  });

  it("caps the source period at the pace window", () => {
    const result = compute(
      [row({ pagesCount: 100 })],
      pace({ firstEventDate: subDays(TODAY, 400), lastEventDate: subDays(TODAY, 1) }),
    );

    expect(result.pace.sourcePeriodDays).toBe(PACE_WINDOW_DAYS);
  });
});
