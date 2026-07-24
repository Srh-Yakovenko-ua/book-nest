import type { CharacterSummaryView } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { SeriesAppearanceLike, SeriesReadingContextBook } from "./series-representative.js";

import {
  pickSeriesRepresentatives,
  resolveAllowedBookIds,
  resolveDefaultReadingContext,
  sortSeriesSummaries,
} from "./series-representative.js";

const BOOK_ONE = "11111111-1111-4111-8111-111111111111";
const BOOK_TWO = "22222222-2222-4222-8222-222222222222";
const BOOK_THREE = "33333333-3333-4333-8333-333333333333";
const BOOK_TWO_ALT = "44444444-4444-4444-8444-444444444444";
const BOOK_UNNUMBERED = "55555555-5555-4555-8555-555555555555";

const seriesBooks = [
  { id: BOOK_ONE, partNumber: 1 },
  { id: BOOK_TWO, partNumber: 2 },
  { id: BOOK_THREE, partNumber: 3 },
];

function appearance(
  overrides: Partial<SeriesAppearanceLike> & { bookId: string },
): SeriesAppearanceLike {
  return {
    characterId: "character",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function summary(overrides: Partial<CharacterSummaryView>): CharacterSummaryView {
  return {
    avatar: null,
    characterId: "character",
    displayName: null,
    entityKind: "individual",
    hiddenFields: [],
    id: "appearance",
    importance: "supporting",
    isFavorite: false,
    name: "Nameless",
    portrait: null,
    status: "active",
    ...overrides,
  };
}

describe("resolveAllowedBookIds", () => {
  it("returns every series book when there is no context", () => {
    expect(resolveAllowedBookIds({ contextBook: null, includeFuture: false, seriesBooks })).toEqual(
      [BOOK_ONE, BOOK_TWO, BOOK_THREE],
    );
  });

  it("returns every series book when future books are explicitly included", () => {
    expect(
      resolveAllowedBookIds({
        contextBook: { id: BOOK_ONE, partNumber: 1 },
        includeFuture: true,
        seriesBooks,
      }),
    ).toEqual([BOOK_ONE, BOOK_TWO, BOOK_THREE]);
  });

  it("masks books past the context part number", () => {
    expect(
      resolveAllowedBookIds({
        contextBook: { id: BOOK_TWO, partNumber: 2 },
        includeFuture: false,
        seriesBooks,
      }),
    ).toEqual([BOOK_ONE, BOOK_TWO]);
  });

  it("includes duplicate part numbers at the context boundary", () => {
    expect(
      resolveAllowedBookIds({
        contextBook: { id: BOOK_TWO, partNumber: 2 },
        includeFuture: false,
        seriesBooks: [...seriesBooks, { id: BOOK_TWO_ALT, partNumber: 2 }],
      }),
    ).toEqual([BOOK_ONE, BOOK_TWO, BOOK_TWO_ALT]);
  });

  it("excludes books without a part number conservatively", () => {
    expect(
      resolveAllowedBookIds({
        contextBook: { id: BOOK_TWO, partNumber: 2 },
        includeFuture: false,
        seriesBooks: [...seriesBooks, { id: BOOK_UNNUMBERED, partNumber: null }],
      }),
    ).toEqual([BOOK_ONE, BOOK_TWO]);
  });

  it("falls back to only the context book when its part number is unknown", () => {
    expect(
      resolveAllowedBookIds({
        contextBook: { id: BOOK_UNNUMBERED, partNumber: null },
        includeFuture: false,
        seriesBooks: [...seriesBooks, { id: BOOK_UNNUMBERED, partNumber: null }],
      }),
    ).toEqual([BOOK_UNNUMBERED]);
  });
});

describe("pickSeriesRepresentatives", () => {
  const partNumberByBookId = new Map<string, null | number>([
    [BOOK_ONE, 1],
    [BOOK_THREE, 3],
    [BOOK_TWO, 2],
    [BOOK_UNNUMBERED, null],
  ]);

  it("keeps a single appearance per character", () => {
    const result = pickSeriesRepresentatives({
      appearances: [appearance({ bookId: BOOK_ONE, characterId: "paul" })],
      contextBookId: undefined,
      partNumberByBookId,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.bookId).toBe(BOOK_ONE);
  });

  it("prefers the context book appearance", () => {
    const result = pickSeriesRepresentatives({
      appearances: [
        appearance({ bookId: BOOK_ONE, characterId: "paul" }),
        appearance({ bookId: BOOK_TWO, characterId: "paul" }),
      ],
      contextBookId: BOOK_ONE,
      partNumberByBookId,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.bookId).toBe(BOOK_ONE);
  });

  it("uses the latest allowed appearance by part number without a context", () => {
    const result = pickSeriesRepresentatives({
      appearances: [
        appearance({ bookId: BOOK_ONE, characterId: "paul" }),
        appearance({ bookId: BOOK_THREE, characterId: "paul" }),
        appearance({ bookId: BOOK_TWO, characterId: "paul" }),
      ],
      contextBookId: undefined,
      partNumberByBookId,
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.bookId).toBe(BOOK_THREE);
  });

  it("prefers a numbered appearance over an unnumbered one", () => {
    const result = pickSeriesRepresentatives({
      appearances: [
        appearance({ bookId: BOOK_UNNUMBERED, characterId: "paul" }),
        appearance({ bookId: BOOK_ONE, characterId: "paul" }),
      ],
      contextBookId: undefined,
      partNumberByBookId,
    });
    expect(result[0]?.bookId).toBe(BOOK_ONE);
  });

  it("breaks equal part numbers by the newer appearance", () => {
    const partNumbers = new Map<string, null | number>([
      [BOOK_TWO, 2],
      [BOOK_TWO_ALT, 2],
    ]);
    const result = pickSeriesRepresentatives({
      appearances: [
        appearance({
          bookId: BOOK_TWO,
          characterId: "paul",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
        appearance({
          bookId: BOOK_TWO_ALT,
          characterId: "paul",
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
        }),
      ],
      contextBookId: undefined,
      partNumberByBookId: partNumbers,
    });
    expect(result[0]?.bookId).toBe(BOOK_TWO_ALT);
  });

  it("returns one representative per distinct character", () => {
    const result = pickSeriesRepresentatives({
      appearances: [
        appearance({ bookId: BOOK_ONE, characterId: "paul" }),
        appearance({ bookId: BOOK_TWO, characterId: "paul" }),
        appearance({ bookId: BOOK_ONE, characterId: "chani" }),
      ],
      contextBookId: undefined,
      partNumberByBookId,
    });
    expect(result.map((row) => row.characterId).sort()).toEqual(["chani", "paul"]);
  });
});

describe("resolveDefaultReadingContext", () => {
  function readingBook(
    overrides: Partial<SeriesReadingContextBook> & { id: string },
  ): SeriesReadingContextBook {
    return {
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      finishedAt: null,
      partNumber: null,
      ...overrides,
    };
  }

  it("returns a none context for a series with no books", () => {
    expect(resolveDefaultReadingContext({ books: [] })).toEqual({
      contextBookId: null,
      partNumber: null,
      source: "none",
    });
  });

  it("picks the finished book with the greatest part number", () => {
    const result = resolveDefaultReadingContext({
      books: [
        readingBook({ finishedAt: new Date("2026-02-01"), id: BOOK_ONE, partNumber: 1 }),
        readingBook({ finishedAt: new Date("2026-03-01"), id: BOOK_THREE, partNumber: 3 }),
        readingBook({ finishedAt: new Date("2026-02-15"), id: BOOK_TWO, partNumber: 2 }),
      ],
    });
    expect(result).toEqual({
      contextBookId: BOOK_THREE,
      partNumber: 3,
      source: "last_finished_book",
    });
  });

  it("ignores unfinished later books when choosing the last finished", () => {
    const result = resolveDefaultReadingContext({
      books: [
        readingBook({ finishedAt: new Date("2026-02-01"), id: BOOK_ONE, partNumber: 1 }),
        readingBook({ id: BOOK_TWO, partNumber: 2 }),
        readingBook({ id: BOOK_THREE, partNumber: 3 }),
      ],
    });
    expect(result).toEqual({
      contextBookId: BOOK_ONE,
      partNumber: 1,
      source: "last_finished_book",
    });
  });

  it("prefers a numbered finished book over an unnumbered finished book", () => {
    const result = resolveDefaultReadingContext({
      books: [
        readingBook({ finishedAt: new Date("2026-05-01"), id: BOOK_UNNUMBERED, partNumber: null }),
        readingBook({ finishedAt: new Date("2026-02-01"), id: BOOK_TWO, partNumber: 2 }),
      ],
    });
    expect(result).toEqual({
      contextBookId: BOOK_TWO,
      partNumber: 2,
      source: "last_finished_book",
    });
  });

  it("falls back to the first book when nothing is finished", () => {
    const result = resolveDefaultReadingContext({
      books: [
        readingBook({ id: BOOK_TWO, partNumber: 2 }),
        readingBook({ id: BOOK_ONE, partNumber: 1 }),
      ],
    });
    expect(result).toEqual({ contextBookId: BOOK_ONE, partNumber: 1, source: "first_book" });
  });
});

describe("sortSeriesSummaries", () => {
  it("sorts by name", () => {
    const result = sortSeriesSummaries({
      sort: "name",
      summaries: [summary({ name: "Chani" }), summary({ name: "Alia" })],
    });
    expect(result.map((row) => row.name)).toEqual(["Alia", "Chani"]);
  });

  it("sorts by importance rank then name", () => {
    const result = sortSeriesSummaries({
      sort: "importance",
      summaries: [
        summary({ importance: "supporting", name: "Chani" }),
        summary({ importance: "central", name: "Zed" }),
        summary({ importance: "central", name: "Alia" }),
      ],
    });
    expect(result.map((row) => `${row.importance}:${row.name}`)).toEqual([
      "central:Alia",
      "central:Zed",
      "supporting:Chani",
    ]);
  });
});
