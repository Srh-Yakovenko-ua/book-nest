import { describe, expect, it } from "vitest";

import type { SeriesPublisherBookRow } from "./series-publishers.js";

import { summarizeSeriesPublishers } from "./series-publishers.js";

function makeBook(overrides: Partial<SeriesPublisherBookRow> = {}): SeriesPublisherBookRow {
  return {
    publisher: { id: "publisher-vivat", name: "Vivat" },
    ...overrides,
  };
}

describe("summarizeSeriesPublishers empty input", () => {
  it("returns an empty breakdown and a null dominant for a series with no books", () => {
    const summary = summarizeSeriesPublishers([]);

    expect(summary).toEqual({ breakdown: [], dominant: null });
  });

  it("returns an empty breakdown and a null dominant when no book carries a publisher", () => {
    const summary = summarizeSeriesPublishers([
      makeBook({ publisher: null }),
      makeBook({ publisher: null }),
    ]);

    expect(summary).toEqual({ breakdown: [], dominant: null });
  });
});

describe("summarizeSeriesPublishers breakdown counting", () => {
  it("ignores books whose publisher is null while counting the rest", () => {
    const summary = summarizeSeriesPublishers([
      makeBook({ publisher: null }),
      makeBook({ publisher: { id: "publisher-vivat", name: "Vivat" } }),
    ]);

    expect(summary.breakdown).toEqual([{ bookCount: 1, id: "publisher-vivat", name: "Vivat" }]);
  });

  it("sums repeated appearances of the same publisher instead of duplicating it", () => {
    const summary = summarizeSeriesPublishers([
      makeBook({ publisher: { id: "publisher-vivat", name: "Vivat" } }),
      makeBook({ publisher: { id: "publisher-vivat", name: "Vivat" } }),
      makeBook({ publisher: { id: "publisher-vivat", name: "Vivat" } }),
    ]);

    expect(summary.breakdown).toEqual([{ bookCount: 3, id: "publisher-vivat", name: "Vivat" }]);
  });
});

describe("summarizeSeriesPublishers breakdown ordering", () => {
  it("orders the breakdown by book count descending", () => {
    const summary = summarizeSeriesPublishers([
      makeBook({ publisher: { id: "publisher-abab", name: "A-BA-BA" } }),
      makeBook({ publisher: { id: "publisher-vivat", name: "Vivat" } }),
      makeBook({ publisher: { id: "publisher-vivat", name: "Vivat" } }),
    ]);

    expect(summary.breakdown.map((entry) => entry.id)).toEqual([
      "publisher-vivat",
      "publisher-abab",
    ]);
  });

  it("breaks a book-count tie using Ukrainian collation order rather than byte order", () => {
    const summary = summarizeSeriesPublishers([
      makeBook({ publisher: { id: "publisher-yaroslaviv-val", name: "Ярославів Вал" } }),
      makeBook({ publisher: { id: "publisher-abab", name: "А-БА-БА-ГА-ЛА-МА-ГА" } }),
      makeBook({ publisher: { id: "publisher-vivat", name: "Vivat" } }),
    ]);

    expect(summary.breakdown.map((entry) => entry.id)).toEqual([
      "publisher-abab",
      "publisher-yaroslaviv-val",
      "publisher-vivat",
    ]);
  });
});

describe("summarizeSeriesPublishers dominant", () => {
  it("selects the publisher with a book count strictly greater than the runner-up", () => {
    const summary = summarizeSeriesPublishers([
      makeBook({ publisher: { id: "publisher-vivat", name: "Vivat" } }),
      makeBook({ publisher: { id: "publisher-vivat", name: "Vivat" } }),
      makeBook({ publisher: { id: "publisher-abab", name: "A-BA-BA" } }),
    ]);

    expect(summary.dominant).toEqual({ bookCount: 2, id: "publisher-vivat", name: "Vivat" });
  });

  it("returns a null dominant when the top two publishers tie on book count", () => {
    const summary = summarizeSeriesPublishers([
      makeBook({ publisher: { id: "publisher-vivat", name: "Vivat" } }),
      makeBook({ publisher: { id: "publisher-abab", name: "A-BA-BA" } }),
    ]);

    expect(summary.dominant).toBeNull();
  });

  it("returns the sole publisher as dominant with a book count of one", () => {
    const summary = summarizeSeriesPublishers([
      makeBook({ publisher: { id: "publisher-vivat", name: "Vivat" } }),
    ]);

    expect(summary.dominant).toEqual({ bookCount: 1, id: "publisher-vivat", name: "Vivat" });
  });
});
