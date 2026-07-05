import { describe, expect, it } from "vitest";

import {
  filterSeries,
  isSeriesUnfinished,
  seriesProgress,
  seriesReadingState,
  sortSeries,
} from "./series-derive";
import { makeSeriesView } from "./series.fixtures";

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
      items,
      readingFilter: "not_started",
      search: "",
      statusFilter: "all",
      tab: "all",
    });
    expect(result.map((series) => series.id)).toEqual(["b"]);
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
