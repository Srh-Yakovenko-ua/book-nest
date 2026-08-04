import { describe, expect, it } from "vitest";

import type { SeriesAdvancedFilters, SeriesAttentionFilter } from "./series-derive";

import {
  countActiveSeriesFilters,
  countSeriesAttention,
  countSeriesNeedingAttention,
  EMPTY_SERIES_ADVANCED_FILTERS,
  filterSeries,
  hasActiveSeriesFilters,
  isSeriesUnfinished,
  selectAlmostReadSeries,
  seriesAttentionReasons,
  seriesCompleteness,
  seriesHasIncompleteCoreData,
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
      attention: null,
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
      attention: null,
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
      attention: null,
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
      attention: null,
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

describe("selectAlmostReadSeries", () => {
  it("excludes the series matching excludeId", () => {
    const items = [
      makeSeriesView({ finishedInSeries: 2, id: "a", totalBooks: 5 }),
      makeSeriesView({ finishedInSeries: 2, id: "b", totalBooks: 5 }),
    ];
    expect(selectAlmostReadSeries({ excludeId: "a", items }).map((series) => series.id)).toEqual([
      "b",
    ]);
  });

  it("drops series that are not started, fully read, or missing a next book", () => {
    const items = [
      makeSeriesView({ finishedInSeries: 0, id: "zero", totalBooks: 5 }),
      makeSeriesView({ booksInSeries: 5, finishedInSeries: 5, id: "full", totalBooks: 5 }),
      makeSeriesView({ finishedInSeries: 2, id: "no-next", nextBook: null, totalBooks: 5 }),
      makeSeriesView({ finishedInSeries: 2, id: "ok", totalBooks: 5 }),
    ];
    expect(
      selectAlmostReadSeries({ excludeId: undefined, items }).map((series) => series.id),
    ).toEqual(["ok"]);
  });

  it("orders by fewest books left, then by highest progress percent", () => {
    const items = [
      makeSeriesView({ booksInSeries: 10, finishedInSeries: 5, id: "far", totalBooks: 10 }),
      makeSeriesView({ booksInSeries: 5, finishedInSeries: 4, id: "near", totalBooks: 5 }),
      makeSeriesView({ booksInSeries: 4, finishedInSeries: 2, id: "mid", totalBooks: 4 }),
    ];
    expect(
      selectAlmostReadSeries({ excludeId: undefined, items }).map((series) => series.id),
    ).toEqual(["near", "mid", "far"]);
  });

  it("breaks equal books-left ties by the higher progress percent", () => {
    const items = [
      makeSeriesView({ booksInSeries: 6, finishedInSeries: 3, id: "low", totalBooks: 6 }),
      makeSeriesView({ booksInSeries: 8, finishedInSeries: 5, id: "high", totalBooks: 8 }),
    ];
    expect(
      selectAlmostReadSeries({ excludeId: undefined, items }).map((series) => series.id),
    ).toEqual(["high", "low"]);
  });

  it("caps the result at three series", () => {
    const items = Array.from({ length: 5 }, (_, index) =>
      makeSeriesView({
        booksInSeries: 5,
        finishedInSeries: index + 1,
        id: `s${index}`,
        totalBooks: 10,
      }),
    );
    expect(selectAlmostReadSeries({ excludeId: undefined, items })).toHaveLength(3);
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

describe("seriesHasIncompleteCoreData", () => {
  const complete = makeSeriesView({
    authors: [{ id: "author-1", name: "Анна" }],
    description: "Опис серії",
    genres: ["fantasy"],
  });

  it("is false when author and genre are present", () => {
    expect(seriesHasIncompleteCoreData(complete)).toBe(false);
  });

  it("is true when the author list is empty", () => {
    expect(seriesHasIncompleteCoreData(makeSeriesView({ ...complete, authors: [] }))).toBe(true);
  });

  it("is true when the genre list is empty", () => {
    expect(seriesHasIncompleteCoreData(makeSeriesView({ ...complete, genres: [] }))).toBe(true);
  });

  it("ignores a missing or blank description when author and genre are present", () => {
    expect(seriesHasIncompleteCoreData(makeSeriesView({ ...complete, description: null }))).toBe(
      false,
    );
    expect(seriesHasIncompleteCoreData(makeSeriesView({ ...complete, description: "   " }))).toBe(
      false,
    );
  });
});

describe("seriesAttentionReasons", () => {
  const populated = {
    authors: [{ id: "author-1", name: "Анна" }],
    description: "Опис серії",
    genres: ["fantasy"],
  };

  it("returns no reasons for a fully populated series", () => {
    expect(
      seriesAttentionReasons(
        makeSeriesView({ ...populated, booksInSeries: 3, status: "ongoing", totalBooks: 3 }),
      ),
    ).toEqual([]);
  });

  it("flags an empty series", () => {
    expect(
      seriesAttentionReasons(
        makeSeriesView({ ...populated, booksInSeries: 0, status: "ongoing", totalBooks: 3 }),
      ),
    ).toEqual(["empty"]);
  });

  it("flags an unknown release status", () => {
    expect(
      seriesAttentionReasons(
        makeSeriesView({ ...populated, booksInSeries: 3, status: "unknown", totalBooks: 3 }),
      ),
    ).toEqual(["unknown_status"]);
  });

  it("flags a completed series missing some of its planned books", () => {
    expect(
      seriesAttentionReasons(
        makeSeriesView({ ...populated, booksInSeries: 2, status: "completed", totalBooks: 5 }),
      ),
    ).toEqual(["incomplete_set"]);
  });

  it("returns overlapping reasons in display order", () => {
    expect(
      seriesAttentionReasons(
        makeSeriesView({
          authors: [],
          booksInSeries: 0,
          description: null,
          genres: [],
          status: "unknown",
          totalBooks: 3,
        }),
      ),
    ).toEqual(["empty", "unknown_status", "incomplete_data"]);
  });
});

describe("countSeriesAttention", () => {
  it("tallies each reason independently, counting overlaps once per reason", () => {
    const items = [
      makeSeriesView({
        authors: [{ id: "a", name: "Анна" }],
        booksInSeries: 0,
        description: "Опис",
        genres: ["fantasy"],
        status: "ongoing",
        totalBooks: 3,
      }),
      makeSeriesView({
        authors: [],
        booksInSeries: 2,
        description: null,
        genres: [],
        status: "completed",
        totalBooks: 5,
      }),
    ];
    expect(countSeriesAttention(items)).toEqual({
      empty: 1,
      incomplete_data: 1,
      incomplete_set: 1,
      unknown_status: 0,
    });
  });
});

describe("countSeriesNeedingAttention", () => {
  it("counts a series with several reasons only once", () => {
    const items = [
      makeSeriesView({
        authors: [],
        booksInSeries: 0,
        description: null,
        genres: [],
        status: "unknown",
        totalBooks: 3,
      }),
      makeSeriesView({
        authors: [{ id: "a", name: "Анна" }],
        booksInSeries: 3,
        description: "Опис",
        genres: ["fantasy"],
        status: "ongoing",
        totalBooks: 3,
      }),
    ];
    expect(countSeriesNeedingAttention(items)).toBe(1);
  });
});

describe("filterSeries by attention", () => {
  const items = [
    makeSeriesView({
      authors: [{ id: "a", name: "Анна" }],
      booksInSeries: 0,
      description: "Опис",
      genres: ["fantasy"],
      id: "needs-attention",
      status: "ongoing",
      totalBooks: 3,
    }),
    makeSeriesView({
      authors: [{ id: "a", name: "Анна" }],
      booksInSeries: 3,
      description: "Опис",
      genres: ["fantasy"],
      id: "clean",
      status: "ongoing",
      totalBooks: 3,
    }),
  ];

  function run(attention: null | SeriesAttentionFilter) {
    return filterSeries({
      advanced: EMPTY_SERIES_ADVANCED_FILTERS,
      attention,
      items,
      readingFilter: "all",
      search: "",
      statusFilter: "all",
      tab: "all",
    }).map((series) => series.id);
  }

  it("keeps every series when attention is null", () => {
    expect(run(null)).toEqual(["needs-attention", "clean"]);
  });

  it("keeps only series with at least one reason for the any filter", () => {
    expect(run("any")).toEqual(["needs-attention"]);
  });

  it("keeps only series matching a specific reason", () => {
    expect(run("empty")).toEqual(["needs-attention"]);
    expect(run("unknown_status")).toEqual([]);
  });
});
