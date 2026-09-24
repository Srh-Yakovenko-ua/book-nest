import { describe, expect, it } from "vitest";

import type { ContextualAppearance, ReadingContextWindow } from "./reading-context-window.js";

import {
  collectPositionHiddenAppearanceIds,
  collectUnreachableCharacterIds,
  isAppearanceRevealable,
  isBookWithinReadingContextWindow,
  resolveReadingContextWindow,
  UNRESTRICTED_READING_CONTEXT_WINDOW,
} from "./reading-context-window.js";

const CURRENT_BOOK = "current-book";
const EARLIER_BOOK = "earlier-book";
const LATER_BOOK = "later-book";
const TIED_BOOK = "tied-book";

function appearance(overrides: Partial<ContextualAppearance> = {}): ContextualAppearance {
  return {
    bookId: CURRENT_BOOK,
    firstAppearanceAudioSeconds: null,
    firstAppearanceChapter: null,
    firstAppearancePage: null,
    hidePresenceAsSpoiler: false,
    ...overrides,
  };
}

function windowAt(reader: { audioSeconds?: number; chapter?: number; page?: number }) {
  return {
    allowedBookIds: new Set([CURRENT_BOOK, EARLIER_BOOK]),
    kind: "reading_position",
    positionGate: { contextBookId: CURRENT_BOOK, reader },
  } satisfies ReadingContextWindow;
}

describe("isAppearanceRevealable", () => {
  it("reveals everything that is not presence-hidden without a reading context", () => {
    expect(
      isAppearanceRevealable({
        appearance: appearance({ firstAppearancePage: 500 }),
        window: UNRESTRICTED_READING_CONTEXT_WINDOW,
      }),
    ).toBe(true);
  });

  it("never reveals a presence-hidden appearance", () => {
    expect(
      isAppearanceRevealable({
        appearance: appearance({ hidePresenceAsSpoiler: true }),
        window: UNRESTRICTED_READING_CONTEXT_WINDOW,
      }),
    ).toBe(false);
    expect(
      isAppearanceRevealable({
        appearance: appearance({ hidePresenceAsSpoiler: true }),
        window: windowAt({ page: 999 }),
      }),
    ).toBe(false);
  });

  it("hides an appearance in a book beyond the reading window", () => {
    expect(
      isAppearanceRevealable({
        appearance: appearance({ bookId: LATER_BOOK }),
        window: windowAt({ page: 10 }),
      }),
    ).toBe(false);
  });

  it("reveals an appearance in an earlier book regardless of the in-book position", () => {
    expect(
      isAppearanceRevealable({
        appearance: appearance({ bookId: EARLIER_BOOK, firstAppearancePage: 900 }),
        window: windowAt({ page: 10 }),
      }),
    ).toBe(true);
  });

  it("gates the context book by page, chapter and audio position", () => {
    expect(
      isAppearanceRevealable({
        appearance: appearance({ firstAppearancePage: 300 }),
        window: windowAt({ page: 20 }),
      }),
    ).toBe(false);
    expect(
      isAppearanceRevealable({
        appearance: appearance({ firstAppearanceChapter: "20" }),
        window: windowAt({ chapter: 5 }),
      }),
    ).toBe(false);
    expect(
      isAppearanceRevealable({
        appearance: appearance({ firstAppearanceAudioSeconds: 36000 }),
        window: windowAt({ audioSeconds: 600 }),
      }),
    ).toBe(false);
  });

  it("reveals an appearance the reader has already reached", () => {
    expect(
      isAppearanceRevealable({
        appearance: appearance({ firstAppearanceChapter: "3" }),
        window: windowAt({ chapter: 5 }),
      }),
    ).toBe(true);
  });
});

describe("isBookWithinReadingContextWindow", () => {
  it("accepts every book without a reading context", () => {
    expect(
      isBookWithinReadingContextWindow({
        bookId: LATER_BOOK,
        window: UNRESTRICTED_READING_CONTEXT_WINDOW,
      }),
    ).toBe(true);
  });

  it("rejects a book the reader has not reached", () => {
    expect(
      isBookWithinReadingContextWindow({ bookId: LATER_BOOK, window: windowAt({ page: 1 }) }),
    ).toBe(false);
    expect(
      isBookWithinReadingContextWindow({ bookId: EARLIER_BOOK, window: windowAt({ page: 1 }) }),
    ).toBe(true);
  });
});

describe("collectPositionHiddenAppearanceIds", () => {
  it("returns only the appearances the reader has not reached yet", () => {
    const hidden = collectPositionHiddenAppearanceIds({
      appearances: [
        { ...appearance({ firstAppearanceChapter: "2" }), id: "reached" },
        { ...appearance({ firstAppearanceChapter: "40" }), id: "unreached" },
        { ...appearance(), id: "undeclared" },
      ],
      window: windowAt({ chapter: 10 }),
    });
    expect(hidden).toEqual(["unreached"]);
  });

  it("returns nothing without a reading context", () => {
    const hidden = collectPositionHiddenAppearanceIds({
      appearances: [{ ...appearance({ firstAppearancePage: 900 }), id: "late" }],
      window: UNRESTRICTED_READING_CONTEXT_WINDOW,
    });
    expect(hidden).toEqual([]);
  });
});

describe("collectUnreachableCharacterIds", () => {
  it("keeps a character reachable when any of its appearances is revealable", () => {
    const unreachable = collectUnreachableCharacterIds({
      appearances: [
        { ...appearance({ bookId: EARLIER_BOOK }), characterId: "known-from-part-one" },
        { ...appearance({ firstAppearanceChapter: "40" }), characterId: "known-from-part-one" },
      ],
      characterIds: ["known-from-part-one"],
      window: windowAt({ chapter: 5 }),
    });
    expect([...unreachable]).toEqual([]);
  });

  it("reports a character whose every appearance is out of reach", () => {
    const unreachable = collectUnreachableCharacterIds({
      appearances: [
        { ...appearance({ firstAppearanceChapter: "40" }), characterId: "later-chapter" },
        { ...appearance({ bookId: LATER_BOOK }), characterId: "future-part" },
        { ...appearance({ hidePresenceAsSpoiler: true }), characterId: "presence-hidden" },
        { ...appearance({ firstAppearanceChapter: "2" }), characterId: "reached" },
      ],
      characterIds: ["later-chapter", "future-part", "presence-hidden", "reached"],
      window: windowAt({ chapter: 5 }),
    });
    expect([...unreachable].sort()).toEqual(["future-part", "later-chapter", "presence-hidden"]);
  });

  it("reports every character whose appearances are unknown", () => {
    expect([
      ...collectUnreachableCharacterIds({
        appearances: [],
        characterIds: ["unlinked", "only-in-a-trashed-book"],
        window: windowAt({ page: 1 }),
      }),
    ]).toEqual(["unlinked", "only-in-a-trashed-book"]);
  });

  it("reports nobody when no character is under consideration", () => {
    expect([
      ...collectUnreachableCharacterIds({
        appearances: [],
        characterIds: [],
        window: windowAt({ page: 1 }),
      }),
    ]).toEqual([]);
  });
});

describe("resolveReadingContextWindow", () => {
  const bookReader = {
    findOwnedBookContext: ({ bookId }: { bookId: string }) =>
      Promise.resolve({ id: bookId, partNumber: 2, seriesId: "series" }),
    listSeriesBooks: () =>
      Promise.resolve([
        { id: EARLIER_BOOK, partNumber: 1 },
        { id: CURRENT_BOOK, partNumber: 2 },
        { id: LATER_BOOK, partNumber: 3 },
      ]),
  };

  it("allows the context book and every earlier part of its series", async () => {
    const window = await resolveReadingContextWindow({
      bookReader,
      contextBookId: CURRENT_BOOK,
      notFoundCode: "book_not_found",
      readingPosition: { chapter: 4 },
      userId: "user",
    });

    expect([...window.allowedBookIds].sort()).toEqual([EARLIER_BOOK, CURRENT_BOOK].sort());
    expect(window.positionGate).toEqual({
      contextBookId: CURRENT_BOOK,
      reader: { chapter: 4 },
    });
  });

  it("leaves the position gate empty when the reader declares no unit", async () => {
    const window = await resolveReadingContextWindow({
      bookReader,
      contextBookId: CURRENT_BOOK,
      notFoundCode: "book_not_found",
      readingPosition: undefined,
      userId: "user",
    });

    expect(window.positionGate).toBeNull();
  });

  it("keeps a sibling tied at the context part number outside the window", async () => {
    const tiedSeriesReader = {
      ...bookReader,
      listSeriesBooks: () =>
        Promise.resolve([
          { id: EARLIER_BOOK, partNumber: 1 },
          { id: CURRENT_BOOK, partNumber: 2 },
          { id: TIED_BOOK, partNumber: 2 },
          { id: LATER_BOOK, partNumber: 3 },
        ]),
    };

    const window = await resolveReadingContextWindow({
      bookReader: tiedSeriesReader,
      contextBookId: CURRENT_BOOK,
      notFoundCode: "book_not_found",
      readingPosition: { chapter: 4 },
      userId: "user",
    });

    expect(isBookWithinReadingContextWindow({ bookId: TIED_BOOK, window })).toBe(false);
    expect(isBookWithinReadingContextWindow({ bookId: CURRENT_BOOK, window })).toBe(true);
    expect(isBookWithinReadingContextWindow({ bookId: EARLIER_BOOK, window })).toBe(true);
    expect(isAppearanceRevealable({ appearance: appearance({ bookId: TIED_BOOK }), window })).toBe(
      false,
    );
  });
});
