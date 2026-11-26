import type { BookView } from "@app/shared";

import { describe, expect, it } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";

import { homeRecentShelf, recentBooksInWindow } from "./home-recent-books";

const KYIV = "Europe/Kyiv";
const TODAY = "2026-11-24";

const BOOK_IDS = {
  first: "0b3c9f4e-2a1d-4e6b-8c7f-1a2b3c4d5e01",
  fourth: "3e6f2c7b-5d4a-4b9e-bf0c-4d5e6f7a8b04",
  second: "1c4d0a5f-3b2e-4f7c-9d8a-2b3c4d5e6f02",
  third: "2d5e1b6a-4c3f-4a8d-ae9b-3c4d5e6f7a03",
} as const;

function addedBook(id: string, createdAt: string): BookView {
  return makeBookView({ createdAt, id });
}

function windowIds(books: readonly BookView[]): string[] {
  return recentBooksInWindow({ books, timeZone: KYIV, today: TODAY }).map(({ book }) => book.id);
}

describe("recentBooksInWindow", () => {
  it("includes a book added today", () => {
    expect(windowIds([addedBook(BOOK_IDS.first, "2026-11-24T08:00:00.000Z")])).toEqual([
      BOOK_IDS.first,
    ]);
  });

  it("includes a book added on the 29th local day before today", () => {
    const shelf = recentBooksInWindow({
      books: [addedBook(BOOK_IDS.first, "2026-10-26T09:00:00.000Z")],
      timeZone: KYIV,
      today: TODAY,
    });

    expect(shelf.map(({ addedDaysAgo }) => addedDaysAgo)).toEqual([29]);
  });

  it("excludes a book added on the 30th local day before today", () => {
    expect(windowIds([addedBook(BOOK_IDS.first, "2026-10-25T09:00:00.000Z")])).toEqual([]);
  });

  it("dates the edge of the window in the profile timezone, not in UTC", () => {
    expect(
      windowIds([
        addedBook(BOOK_IDS.first, "2026-10-25T22:30:00.000Z"),
        addedBook(BOOK_IDS.second, "2026-10-25T21:30:00.000Z"),
      ]),
    ).toEqual([BOOK_IDS.first]);
  });

  it("excludes a book dated after today in the profile timezone", () => {
    expect(windowIds([addedBook(BOOK_IDS.first, "2026-11-24T22:30:00.000Z")])).toEqual([]);
  });

  it("orders the newest first and breaks a tie by id", () => {
    expect(
      windowIds([
        addedBook(BOOK_IDS.first, "2026-11-20T10:00:00.000Z"),
        addedBook(BOOK_IDS.third, "2026-11-22T10:00:00.000Z"),
        addedBook(BOOK_IDS.second, "2026-11-22T10:00:00.000Z"),
      ]),
    ).toEqual([BOOK_IDS.second, BOOK_IDS.third, BOOK_IDS.first]);
  });

  it("keeps at most three books, the newest ones", () => {
    expect(
      windowIds([
        addedBook(BOOK_IDS.first, "2026-11-01T10:00:00.000Z"),
        addedBook(BOOK_IDS.second, "2026-11-10T10:00:00.000Z"),
        addedBook(BOOK_IDS.third, "2026-11-15T10:00:00.000Z"),
        addedBook(BOOK_IDS.fourth, "2026-11-20T10:00:00.000Z"),
      ]),
    ).toEqual([BOOK_IDS.fourth, BOOK_IDS.third, BOOK_IDS.second]);
  });
});

describe("homeRecentShelf", () => {
  it("is loading before the first response", () => {
    expect(
      homeRecentShelf({ query: { data: undefined, isError: false }, timeZone: KYIV, today: TODAY }),
    ).toEqual({ kind: "loading" });
  });

  it("is an error when the first request fails", () => {
    expect(
      homeRecentShelf({ query: { data: undefined, isError: true }, timeZone: KYIV, today: TODAY }),
    ).toEqual({ kind: "error" });
  });

  it("is hidden when no book falls inside the window", () => {
    const old = addedBook(BOOK_IDS.first, "2026-09-01T10:00:00.000Z");

    expect(
      homeRecentShelf({
        query: { data: { recentlyAdded: [old] }, isError: false },
        timeZone: KYIV,
        today: TODAY,
      }),
    ).toEqual({ kind: "hidden" });
  });

  it("shows the books in the window from cached data during a refetch error", () => {
    const recent = addedBook(BOOK_IDS.first, "2026-11-23T10:00:00.000Z");

    expect(
      homeRecentShelf({
        query: { data: { recentlyAdded: [recent] }, isError: true },
        timeZone: KYIV,
        today: TODAY,
      }),
    ).toEqual({ books: [{ addedDaysAgo: 1, book: recent }], kind: "books" });
  });
});
