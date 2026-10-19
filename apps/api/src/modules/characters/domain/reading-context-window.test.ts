import { describe, expect, it } from "vitest";

import type { ReadingContextWindow } from "./reading-context-window.js";

import {
  collectUnreachableCharacterIds,
  isBookWithinReadingContextWindow,
  resolveReadingContextWindow,
  UNRESTRICTED_READING_CONTEXT_WINDOW,
} from "./reading-context-window.js";

const CURRENT_BOOK = "current-book";
const EARLIER_BOOK = "earlier-book";
const LATER_BOOK = "later-book";
const TIED_BOOK = "tied-book";

const CONTEXT_WINDOW = {
  allowedBookIds: new Set([CURRENT_BOOK, EARLIER_BOOK]),
  kind: "context_books",
} satisfies ReadingContextWindow;

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
    expect(isBookWithinReadingContextWindow({ bookId: LATER_BOOK, window: CONTEXT_WINDOW })).toBe(
      false,
    );
    expect(isBookWithinReadingContextWindow({ bookId: EARLIER_BOOK, window: CONTEXT_WINDOW })).toBe(
      true,
    );
  });
});

describe("collectUnreachableCharacterIds", () => {
  it("keeps a character reachable when any of its appearances is inside the window", () => {
    const unreachable = collectUnreachableCharacterIds({
      appearances: [
        { bookId: LATER_BOOK, characterId: "known-from-part-one" },
        { bookId: EARLIER_BOOK, characterId: "known-from-part-one" },
      ],
      characterIds: ["known-from-part-one"],
      window: CONTEXT_WINDOW,
    });
    expect([...unreachable]).toEqual([]);
  });

  it("reports a character whose every appearance is in a book beyond the window", () => {
    const unreachable = collectUnreachableCharacterIds({
      appearances: [
        { bookId: LATER_BOOK, characterId: "future-part" },
        { bookId: CURRENT_BOOK, characterId: "current-part" },
        { bookId: EARLIER_BOOK, characterId: "earlier-part" },
      ],
      characterIds: ["future-part", "current-part", "earlier-part"],
      window: CONTEXT_WINDOW,
    });
    expect([...unreachable]).toEqual(["future-part"]);
  });

  it("reports nobody with appearances only in later books when there is no reading context", () => {
    const unreachable = collectUnreachableCharacterIds({
      appearances: [{ bookId: LATER_BOOK, characterId: "future-part" }],
      characterIds: ["future-part"],
      window: UNRESTRICTED_READING_CONTEXT_WINDOW,
    });
    expect([...unreachable]).toEqual([]);
  });

  it("reports every character whose appearances are unknown", () => {
    expect([
      ...collectUnreachableCharacterIds({
        appearances: [],
        characterIds: ["unlinked", "only-in-a-trashed-book"],
        window: CONTEXT_WINDOW,
      }),
    ]).toEqual(["unlinked", "only-in-a-trashed-book"]);
  });

  it("reports nobody when no character is under consideration", () => {
    expect([
      ...collectUnreachableCharacterIds({
        appearances: [],
        characterIds: [],
        window: CONTEXT_WINDOW,
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
      userId: "user",
    });

    expect(window.kind).toBe("context_books");
    expect([...window.allowedBookIds].sort()).toEqual([EARLIER_BOOK, CURRENT_BOOK].sort());
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
      userId: "user",
    });

    expect(isBookWithinReadingContextWindow({ bookId: TIED_BOOK, window })).toBe(false);
    expect(isBookWithinReadingContextWindow({ bookId: CURRENT_BOOK, window })).toBe(true);
    expect(isBookWithinReadingContextWindow({ bookId: EARLIER_BOOK, window })).toBe(true);
    expect(isBookWithinReadingContextWindow({ bookId: LATER_BOOK, window })).toBe(false);
  });
});
