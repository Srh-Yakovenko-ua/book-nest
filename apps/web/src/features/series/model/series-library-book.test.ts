import { describe, expect, it } from "vitest";

import type { SeriesLibraryBookLabels } from "./series-library-book";

import {
  seriesBookDeliveryContext,
  seriesBookEdition,
  seriesBookLoanContext,
  seriesBookPersonalState,
  toSeriesLibraryBook,
} from "./series-library-book";
import { makeDelivery, makeLoanInfo, makeSeriesBookView } from "./series.fixtures";

const labels: SeriesLibraryBookLabels = {
  ageBadge18Plus: "18+",
  authorsUnknown: "Автор невідомий",
  formatLabel: (value) => `format:${value}`,
  ownershipLabel: (value) => `ownership:${value}`,
  pagesText: (value) => `${value} pages`,
  ratingLabel: (value) => `rating:${value}`,
  statusLabel: (value) => `status:${value}`,
};

const seriesAuthors = [{ id: "author-1", name: "Ребекка Яррос" }];

function mapBook(book: Parameters<typeof toSeriesLibraryBook>[0]["book"]) {
  return toSeriesLibraryBook({ book, labels, seriesAuthors });
}

describe("toSeriesLibraryBook", () => {
  it("hides authors that match the series authors", () => {
    expect(mapBook(makeSeriesBookView()).authors).toEqual([]);
  });

  it("shows authors when the book has an author the series does not", () => {
    const book = makeSeriesBookView({
      authors: [
        { id: "author-1", name: "Ребекка Яррос" },
        { id: "author-2", name: "Інший автор" },
      ],
    });

    expect(mapBook(book).authors).toEqual(["Ребекка Яррос", "Інший автор"]);
  });

  it("falls back to the unknown-author label when the book has no authors of its own", () => {
    expect(mapBook(makeSeriesBookView({ authors: [] })).authors).toEqual(["Автор невідомий"]);
  });

  it("omits data the series payload does not carry", () => {
    const mapped = mapBook(makeSeriesBookView());

    expect(mapped.formats).toBeUndefined();
    expect(mapped.genres).toBeUndefined();
    expect(mapped.isInReadingQueue).toBeUndefined();
    expect(mapped.publisher).toBeUndefined();
    expect(mapped.series).toBeUndefined();
    expect(mapped.tags).toBeUndefined();
    expect(mapped.year).toBeUndefined();
  });

  it("adds the 18+ badge only for adult books", () => {
    expect(mapBook(makeSeriesBookView({ ageCategory: "18_plus" })).ageBadge).toBe("18+");
    expect(
      mapBook(makeSeriesBookView({ ageCategory: "no_restrictions" })).ageBadge,
    ).toBeUndefined();
  });

  it("keeps a real rating and drops null or zero ratings", () => {
    expect(mapBook(makeSeriesBookView({ rating: 9 })).rating).toBe(9);
    expect(mapBook(makeSeriesBookView({ rating: 9 })).ratingLabel).toBe("rating:9");
    expect(mapBook(makeSeriesBookView({ rating: null })).rating).toBeUndefined();
    expect(mapBook(makeSeriesBookView({ rating: 0 })).rating).toBeUndefined();
  });

  it("maps dnf to its own status badge", () => {
    const mapped = mapBook(makeSeriesBookView({ readingStatus: "dnf" }));

    expect(mapped.status.value).toBe("dnf");
    expect(mapped.status.label).toBe("status:dnf");
  });

  it("drops the ownership badge when nothing is known", () => {
    expect(mapBook(makeSeriesBookView({ ownershipStatus: "none" })).ownership).toBeUndefined();
    expect(mapBook(makeSeriesBookView({ ownershipStatus: "owned" })).ownership?.label).toBe(
      "ownership:owned",
    );
  });
});

describe("seriesBookEdition", () => {
  it("builds an icon line per format, pages and year", () => {
    const book = makeSeriesBookView({ formats: ["paper"], pagesCount: 384, publicationYear: 2023 });

    expect(seriesBookEdition({ book, labels, seriesPublishers: [] })).toEqual([
      { icon: "book", label: "format:paper" },
      { icon: "pages", label: "384 pages" },
      { icon: "calendar", label: "2023" },
    ]);
  });

  it("keeps a line for each format", () => {
    const book = makeSeriesBookView({
      formats: ["paper", "audiobook"],
      pagesCount: null,
      publicationYear: null,
    });

    expect(seriesBookEdition({ book, labels, seriesPublishers: [] })).toEqual([
      { icon: "book", label: "format:paper" },
      { icon: "headphones", label: "format:audiobook" },
    ]);
  });

  it("omits missing values without leaving gaps", () => {
    const book = makeSeriesBookView({ formats: [], pagesCount: null, publicationYear: 2020 });

    expect(seriesBookEdition({ book, labels, seriesPublishers: [] })).toEqual([
      { icon: "calendar", label: "2020" },
    ]);
  });

  it("returns an empty list when no edition data exists", () => {
    const book = makeSeriesBookView({ formats: [], pagesCount: null, publicationYear: null });

    expect(seriesBookEdition({ book, labels, seriesPublishers: [] })).toEqual([]);
  });

  it("appends the publisher line when the series has several publishers", () => {
    const book = makeSeriesBookView({
      formats: [],
      pagesCount: null,
      publicationYear: null,
      publisher: { id: "publisher-2", name: "Ранок" },
    });

    expect(
      seriesBookEdition({
        book,
        labels,
        seriesPublishers: [
          { id: "publisher-1", name: "Vivat" },
          { id: "publisher-2", name: "Ранок" },
        ],
      }),
    ).toEqual([{ icon: "building", label: "Ранок" }]);
  });

  it("hides the publisher line when the series shares a single publisher", () => {
    const book = makeSeriesBookView({
      formats: [],
      pagesCount: null,
      publicationYear: null,
      publisher: { id: "publisher-1", name: "Vivat" },
    });

    expect(
      seriesBookEdition({ book, labels, seriesPublishers: [{ id: "publisher-1", name: "Vivat" }] }),
    ).toEqual([]);
  });

  it("hides the publisher line when the book has no publisher of its own", () => {
    const book = makeSeriesBookView({
      formats: [],
      pagesCount: null,
      publicationYear: null,
      publisher: null,
    });

    expect(
      seriesBookEdition({
        book,
        labels,
        seriesPublishers: [
          { id: "publisher-1", name: "Vivat" },
          { id: "publisher-2", name: "Ранок" },
        ],
      }),
    ).toEqual([]);
  });
});

describe("seriesBookLoanContext", () => {
  it("reports the lender and expected return for a lent book", () => {
    const book = makeSeriesBookView({
      loanInfo: makeLoanInfo({ expectedReturnDate: "2026-08-18", personName: "Олена" }),
      ownershipStatus: "lent_to_someone",
    });

    expect(seriesBookLoanContext(book)).toEqual({
      expectedReturn: "2026-08-18",
      kind: "lent",
      personName: "Олена",
    });
  });

  it("keeps the lent context without an expected return date", () => {
    const book = makeSeriesBookView({
      loanInfo: makeLoanInfo({ expectedReturnDate: null, personName: "Олена" }),
      ownershipStatus: "lent_to_someone",
    });

    expect(seriesBookLoanContext(book)).toEqual({
      expectedReturn: null,
      kind: "lent",
      personName: "Олена",
    });
  });

  it("reports who a borrowed book came from", () => {
    const book = makeSeriesBookView({
      loanInfo: makeLoanInfo({ personName: "Максим" }),
      ownershipStatus: "borrowed_from_someone",
    });

    expect(seriesBookLoanContext(book)).toEqual({ kind: "borrowed", personName: "Максим" });
  });

  it("has no loan context without loan info", () => {
    expect(
      seriesBookLoanContext(makeSeriesBookView({ loanInfo: null, ownershipStatus: "owned" })),
    ).toBeUndefined();
  });
});

describe("seriesBookDeliveryContext", () => {
  it("reports the delivery for a book in transit", () => {
    const book = makeSeriesBookView({
      activeDelivery: makeDelivery({
        deliveryService: "Нова Пошта",
        expectedDeliveryDate: "2026-08-01",
        trackingUrl: "https://track.example/1",
      }),
      ownershipStatus: "in_transit",
    });

    expect(seriesBookDeliveryContext(book)).toEqual({
      expectedDeliveryDate: "2026-08-01",
      service: "Нова Пошта",
      trackingUrl: "https://track.example/1",
    });
  });

  it("has no delivery context without an active delivery", () => {
    expect(
      seriesBookDeliveryContext(
        makeSeriesBookView({ activeDelivery: null, ownershipStatus: "in_transit" }),
      ),
    ).toBeUndefined();
  });

  it("has no delivery context for a book that is not in transit", () => {
    expect(
      seriesBookDeliveryContext(
        makeSeriesBookView({
          activeDelivery: makeDelivery({ expectedDeliveryDate: "2026-08-01" }),
          ownershipStatus: "owned",
        }),
      ),
    ).toBeUndefined();
  });
});

describe("seriesBookPersonalState", () => {
  it("returns a progress state for a book being read", () => {
    const book = makeSeriesBookView({
      currentPage: 180,
      pagesCount: 640,
      readingStatus: "reading",
      startedAt: "2026-05-02T00:00:00.000Z",
    });

    expect(seriesBookPersonalState(book)).toEqual({
      kind: "progress",
      pages: { current: 180, total: 640 },
      percent: 28,
      rereading: false,
      startedAt: "2026-05-02T00:00:00.000Z",
    });
  });

  it("returns a progress state while rereading", () => {
    const book = makeSeriesBookView({
      currentPage: 50,
      pagesCount: 100,
      readingStatus: "rereading",
    });

    expect(seriesBookPersonalState(book)).toEqual({
      kind: "progress",
      pages: { current: 50, total: 100 },
      percent: 50,
      rereading: true,
      startedAt: null,
    });
  });

  it("marks a finished book with its finished date", () => {
    expect(
      seriesBookPersonalState(
        makeSeriesBookView({ finishedAt: "2026-03-14T00:00:00.000Z", readingStatus: "finished" }),
      ),
    ).toEqual({ finishedAt: "2026-03-14T00:00:00.000Z", kind: "finished" });
  });

  it("has no finished personal state without a finished date", () => {
    expect(
      seriesBookPersonalState(makeSeriesBookView({ finishedAt: null, readingStatus: "finished" })),
    ).toBeUndefined();
  });

  it("omits progress when the pages are unknown while reading", () => {
    expect(
      seriesBookPersonalState(
        makeSeriesBookView({ currentPage: 10, pagesCount: null, readingStatus: "reading" }),
      ),
    ).toBeUndefined();
    expect(
      seriesBookPersonalState(
        makeSeriesBookView({ currentPage: null, pagesCount: 300, readingStatus: "reading" }),
      ),
    ).toBeUndefined();
    expect(
      seriesBookPersonalState(
        makeSeriesBookView({ currentPage: 10, pagesCount: 0, readingStatus: "reading" }),
      ),
    ).toBeUndefined();
  });

  it("keeps the pause page when paused", () => {
    expect(
      seriesBookPersonalState(
        makeSeriesBookView({ currentPage: 192, pagesCount: 416, readingStatus: "paused" }),
      ),
    ).toEqual({ kind: "paused", pages: { current: 192, total: 416 } });
  });

  it("falls back to a bare pause state without pages", () => {
    expect(
      seriesBookPersonalState(
        makeSeriesBookView({ currentPage: null, pagesCount: 416, readingStatus: "paused" }),
      ),
    ).toEqual({ kind: "paused", pages: null });
  });

  it("marks a dnf book as not finished", () => {
    expect(seriesBookPersonalState(makeSeriesBookView({ readingStatus: "dnf" }))).toEqual({
      kind: "dnf",
    });
  });

  it("has no personal state for statuses without one", () => {
    for (const readingStatus of ["finished", "not_started", "want_to_read"] as const) {
      expect(
        seriesBookPersonalState(
          makeSeriesBookView({ currentPage: 10, pagesCount: 100, readingStatus }),
        ),
      ).toBeUndefined();
    }
  });
});
