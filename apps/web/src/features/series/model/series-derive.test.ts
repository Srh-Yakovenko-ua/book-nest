import { describe, expect, it } from "vitest";

import type { SeriesAdvancedFilters } from "./series-derive";

import {
  countActiveSeriesFilters,
  EMPTY_SERIES_ADVANCED_FILTERS,
  filterSeries,
  hasActiveSeriesFilters,
  isSeriesUnfinished,
  seriesCompleteness,
  seriesMatchesAdvancedFilters,
  seriesProgress,
  seriesReadingState,
  sortSeries,
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

describe("seriesReadingState", () => {
  it("is empty when there are no books", () => {
    expect(seriesReadingState(makeSeriesView({ booksInSeries: 0, finishedInSeries: 0 }))).toBe(
      "empty",
    );
  });

  it("is not_started when books exist but none are finished or in progress", () => {
    expect(
      seriesReadingState(
        makeSeriesView({
          booksInSeries: 3,
          finishedInSeries: 0,
          readingInSeries: 0,
          totalBooks: 3,
        }),
      ),
    ).toBe("not_started");
  });

  it("is in_progress when some but not all books are finished", () => {
    expect(
      seriesReadingState(makeSeriesView({ booksInSeries: 3, finishedInSeries: 1, totalBooks: 3 })),
    ).toBe("in_progress");
  });

  it("is in_progress when a book is being read but none are finished", () => {
    expect(
      seriesReadingState(
        makeSeriesView({
          booksInSeries: 3,
          finishedInSeries: 0,
          readingInSeries: 1,
          totalBooks: 3,
        }),
      ),
    ).toBe("in_progress");
  });

  it("is completed when every book is read", () => {
    expect(
      seriesReadingState(
        makeSeriesView({
          booksInSeries: 3,
          finishedInSeries: 3,
          readingInSeries: 0,
          totalBooks: 3,
        }),
      ),
    ).toBe("completed");
  });
});

describe("isSeriesUnfinished", () => {
  it("is true for a started multi-book series that is not fully read", () => {
    expect(
      isSeriesUnfinished(makeSeriesView({ booksInSeries: 3, finishedInSeries: 1, totalBooks: 5 })),
    ).toBe(true);
  });

  it("is false when the series is fully read", () => {
    expect(
      isSeriesUnfinished(makeSeriesView({ booksInSeries: 3, finishedInSeries: 3, totalBooks: 3 })),
    ).toBe(false);
  });

  it("is true for a multi-book series with a book in progress and none finished", () => {
    expect(
      isSeriesUnfinished(
        makeSeriesView({
          booksInSeries: 3,
          finishedInSeries: 0,
          readingInSeries: 1,
          totalBooks: 5,
        }),
      ),
    ).toBe(true);
  });

  it("is false when nothing has been started yet", () => {
    expect(
      isSeriesUnfinished(
        makeSeriesView({
          booksInSeries: 3,
          finishedInSeries: 0,
          readingInSeries: 0,
          totalBooks: 3,
        }),
      ),
    ).toBe(false);
  });

  it("is false for a single-book series", () => {
    expect(
      isSeriesUnfinished(makeSeriesView({ booksInSeries: 1, finishedInSeries: 1, totalBooks: 1 })),
    ).toBe(false);
  });
});

describe("filterSeries", () => {
  const items = [
    makeSeriesView({ id: "a", name: "Відьмак", status: "completed" }),
    makeSeriesView({
      authors: [{ id: "author-2", name: "Джордж Мартін" }],
      finishedInSeries: 0,
      id: "b",
      name: "Пісня льоду й полум'я",
      readingInSeries: 0,
      status: "ongoing",
    }),
  ];

  it("matches by author name", () => {
    const result = filterSeries({
      advanced: EMPTY_SERIES_ADVANCED_FILTERS,
      items,
      readingFilter: "all",
      search: "мартін",
      statusFilter: "all",
      tab: "all",
    });
    expect(result.map((series) => series.id)).toEqual(["b"]);
  });

  it("filters by cycle status", () => {
    const result = filterSeries({
      advanced: EMPTY_SERIES_ADVANCED_FILTERS,
      items,
      readingFilter: "all",
      search: "",
      statusFilter: "completed",
      tab: "all",
    });
    expect(result.map((series) => series.id)).toEqual(["a"]);
  });

  it("filters by reading state", () => {
    const result = filterSeries({
      advanced: EMPTY_SERIES_ADVANCED_FILTERS,
      items,
      readingFilter: "not_started",
      search: "",
      statusFilter: "all",
      tab: "all",
    });
    expect(result.map((series) => series.id)).toEqual(["b"]);
  });

  it("applies advanced completeness filters alongside the base filters", () => {
    const result = filterSeries({
      advanced: makeAdvancedFilters({ completeness: ["complete"] }),
      items: [
        makeSeriesView({ booksInSeries: 3, id: "full", totalBooks: 3 }),
        makeSeriesView({ booksInSeries: 2, id: "partial", totalBooks: 5 }),
      ],
      readingFilter: "all",
      search: "",
      statusFilter: "all",
      tab: "all",
    });
    expect(result.map((series) => series.id)).toEqual(["full"]);
  });
});

describe("seriesCompleteness", () => {
  it("is no_plan when there is no planned length", () => {
    expect(seriesCompleteness(makeSeriesView({ booksInSeries: 2, totalBooks: null }))).toBe(
      "no_plan",
    );
  });

  it("is complete when the collected count reaches the planned length", () => {
    expect(seriesCompleteness(makeSeriesView({ booksInSeries: 5, totalBooks: 5 }))).toBe(
      "complete",
    );
    expect(seriesCompleteness(makeSeriesView({ booksInSeries: 6, totalBooks: 5 }))).toBe(
      "complete",
    );
  });

  it("is incomplete when fewer books are collected than planned", () => {
    expect(seriesCompleteness(makeSeriesView({ booksInSeries: 2, totalBooks: 5 }))).toBe(
      "incomplete",
    );
  });
});

describe("seriesMatchesAdvancedFilters", () => {
  const series = makeSeriesView({
    authors: [{ id: "author-1", name: "Анна" }],
    booksInSeries: 4,
    finishedInSeries: 2,
    genres: ["fantasy", "romance"],
    totalBooks: 4,
  });

  it("passes an empty filter set", () => {
    expect(seriesMatchesAdvancedFilters({ advanced: EMPTY_SERIES_ADVANCED_FILTERS, series })).toBe(
      true,
    );
  });

  it("filters by the reading-progress range", () => {
    expect(
      seriesMatchesAdvancedFilters({ advanced: makeAdvancedFilters({ progressMin: 60 }), series }),
    ).toBe(false);
    expect(
      seriesMatchesAdvancedFilters({
        advanced: makeAdvancedFilters({ progressMax: 60, progressMin: 40 }),
        series,
      }),
    ).toBe(true);
    expect(
      seriesMatchesAdvancedFilters({ advanced: makeAdvancedFilters({ progressMax: 40 }), series }),
    ).toBe(false);
  });

  it("filters by the books-in-series range", () => {
    expect(
      seriesMatchesAdvancedFilters({ advanced: makeAdvancedFilters({ booksMin: 5 }), series }),
    ).toBe(false);
    expect(
      seriesMatchesAdvancedFilters({ advanced: makeAdvancedFilters({ booksMax: 3 }), series }),
    ).toBe(false);
    expect(
      seriesMatchesAdvancedFilters({
        advanced: makeAdvancedFilters({ booksMax: 5, booksMin: 2 }),
        series,
      }),
    ).toBe(true);
  });

  it("passes when the series shares at least one selected genre", () => {
    expect(
      seriesMatchesAdvancedFilters({
        advanced: makeAdvancedFilters({ genres: ["horror"] }),
        series,
      }),
    ).toBe(false);
    expect(
      seriesMatchesAdvancedFilters({
        advanced: makeAdvancedFilters({ genres: ["horror", "romance"] }),
        series,
      }),
    ).toBe(true);
  });

  it("passes when the series has one of the selected authors", () => {
    expect(
      seriesMatchesAdvancedFilters({
        advanced: makeAdvancedFilters({ authorIds: ["author-2"] }),
        series,
      }),
    ).toBe(false);
    expect(
      seriesMatchesAdvancedFilters({
        advanced: makeAdvancedFilters({ authorIds: ["author-1"] }),
        series,
      }),
    ).toBe(true);
  });

  it("filters by collection completeness", () => {
    expect(
      seriesMatchesAdvancedFilters({
        advanced: makeAdvancedFilters({ completeness: ["incomplete"] }),
        series,
      }),
    ).toBe(false);
    expect(
      seriesMatchesAdvancedFilters({
        advanced: makeAdvancedFilters({ completeness: ["complete", "no_plan"] }),
        series,
      }),
    ).toBe(true);
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

describe("hasActiveSeriesFilters", () => {
  it("is false for an empty filter set", () => {
    expect(hasActiveSeriesFilters(EMPTY_SERIES_ADVANCED_FILTERS)).toBe(false);
  });

  it("is true once any dimension is set", () => {
    expect(hasActiveSeriesFilters(makeAdvancedFilters({ booksMin: 1 }))).toBe(true);
  });
});

describe("sortSeries", () => {
  it("sorts by name ascending", () => {
    const result = sortSeries({
      items: [
        makeSeriesView({ id: "b", name: "Бета" }),
        makeSeriesView({ id: "a", name: "Альфа" }),
      ],
      sort: "name_asc",
    });
    expect(result.map((series) => series.name)).toEqual(["Альфа", "Бета"]);
  });

  it("sorts by most books", () => {
    const result = sortSeries({
      items: [
        makeSeriesView({ booksInSeries: 1, id: "a" }),
        makeSeriesView({ booksInSeries: 7, id: "b" }),
      ],
      sort: "books_desc",
    });
    expect(result.map((series) => series.id)).toEqual(["b", "a"]);
  });

  it("sorts by recent activity", () => {
    const result = sortSeries({
      items: [
        makeSeriesView({ id: "old", lastActivityAt: "2026-01-01T00:00:00.000Z" }),
        makeSeriesView({ id: "new", lastActivityAt: "2026-02-01T00:00:00.000Z" }),
      ],
      sort: "activity_desc",
    });
    expect(result.map((series) => series.id)).toEqual(["new", "old"]);
  });
});
