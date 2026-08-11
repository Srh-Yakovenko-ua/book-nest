import { describe, expect, it } from "vitest";

import type { SeriesAdvancedFilters } from "./series-derive";

import {
  countActiveSeriesFilters,
  EMPTY_SERIES_ADVANCED_FILTERS,
  seriesProgress,
} from "./series-derive";
import { makeSeriesView } from "./series.fixtures";

function makeAdvancedFilters(
  overrides: Partial<SeriesAdvancedFilters> = {},
): SeriesAdvancedFilters {
  return { ...EMPTY_SERIES_ADVANCED_FILTERS, ...overrides };
}

describe("seriesProgress", () => {
  it("uses totalBooks as the denominator when present", () => {
    const progress = seriesProgress(
      makeSeriesView({ booksInSeries: 2, finishedInSeries: 1, totalBooks: 4 }),
    );
    expect(progress).toMatchObject({ denominator: 4, finished: 1, fullyRead: false, percent: 25 });
  });

  it("falls back to booksInSeries when totalBooks is null", () => {
    const progress = seriesProgress(
      makeSeriesView({ booksInSeries: 4, finishedInSeries: 2, totalBooks: null }),
    );
    expect(progress).toMatchObject({ denominator: 4, percent: 50 });
  });

  it("guards division by zero when there are no books", () => {
    const progress = seriesProgress(
      makeSeriesView({ booksInSeries: 0, finishedInSeries: 0, totalBooks: 5 }),
    );
    expect(progress).toMatchObject({ hasBooks: false, percent: 0 });
  });

  it("clamps the percent to 100 when finished exceeds the denominator", () => {
    const progress = seriesProgress(
      makeSeriesView({ booksInSeries: 4, finishedInSeries: 4, totalBooks: 3 }),
    );
    expect(progress.percent).toBe(100);
  });

  it("marks a series fully read only when finished reaches both counts", () => {
    expect(
      seriesProgress(makeSeriesView({ booksInSeries: 3, finishedInSeries: 3, totalBooks: 3 }))
        .fullyRead,
    ).toBe(true);
    expect(
      seriesProgress(makeSeriesView({ booksInSeries: 3, finishedInSeries: 3, totalBooks: 5 }))
        .fullyRead,
    ).toBe(false);
  });
});

describe("countActiveSeriesFilters", () => {
  it("is zero for an empty filter set", () => {
    expect(countActiveSeriesFilters(EMPTY_SERIES_ADVANCED_FILTERS)).toBe(0);
  });

  it("counts each populated array dimension once", () => {
    expect(
      countActiveSeriesFilters(
        makeAdvancedFilters({ authorIds: ["a"], completeness: ["complete"], genres: ["fantasy"] }),
      ),
    ).toBe(3);
  });

  it("counts each range once regardless of which bound is set", () => {
    expect(countActiveSeriesFilters(makeAdvancedFilters({ progressMin: 20 }))).toBe(1);
    expect(
      countActiveSeriesFilters(makeAdvancedFilters({ progressMax: 80, progressMin: 20 })),
    ).toBe(1);
    expect(countActiveSeriesFilters(makeAdvancedFilters({ booksMax: 10 }))).toBe(1);
  });
});
