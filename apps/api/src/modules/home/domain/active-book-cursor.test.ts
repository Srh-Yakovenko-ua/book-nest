import type { Nullable } from "@app/shared";

import { HOME_DASHBOARD_RULES } from "@app/shared";
import { describe, expect, it } from "vitest";

import type { ActiveBookOrderKey } from "./active-book-order.js";

import { decodeActiveBookCursor, encodeActiveBookCursor } from "./active-book-cursor.js";
import { takeActiveBooksPage } from "./active-book-order.js";

const BOOK_ID = "6f1d2c3b-4a59-4e68-8f7a-9b0c1d2e3f40";

function orderedBook(index: number, key: Nullable<string>): ActiveBookOrderKey {
  return { id: uuidOf(index), key };
}

function tamperedCursor(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function uuidOf(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

describe("decodeActiveBookCursor", () => {
  it("reads back a cursor positioned on a dated book", () => {
    const cursor = { id: BOOK_ID, key: "2026-11-20" };

    expect(decodeActiveBookCursor(encodeActiveBookCursor(cursor))).toEqual(cursor);
  });

  it("reads back a cursor positioned on a book with an unknown date", () => {
    const cursor = { id: BOOK_ID, key: null };

    expect(decodeActiveBookCursor(encodeActiveBookCursor(cursor))).toEqual(cursor);
  });

  it("starts from the first page when no cursor is given", () => {
    expect(decodeActiveBookCursor(undefined)).toBeNull();
  });

  it.each([
    ["text that is not a cursor", "not a cursor at all"],
    ["base64 that is not JSON", Buffer.from("hello", "utf8").toString("base64url")],
    ["a JSON null", tamperedCursor(null)],
    ["a JSON array", tamperedCursor([BOOK_ID, "2026-11-20"])],
    ["an id that is not a UUID", tamperedCursor({ id: "book-1", key: "2026-11-20" })],
    ["a key that is not an ISO day", tamperedCursor({ id: BOOK_ID, key: "20.11.2026" })],
    ["a missing key", tamperedCursor({ id: BOOK_ID })],
    ["a missing id", tamperedCursor({ key: "2026-11-20" })],
  ])("falls back to the first page for %s", (_label, value) => {
    expect(decodeActiveBookCursor(value)).toBeNull();
  });
});

describe("cursor paging", () => {
  it("continues after the encoded book on the next request", () => {
    const ordered = [
      orderedBook(1, "2026-11-23"),
      orderedBook(2, "2026-11-22"),
      orderedBook(3, "2026-11-21"),
      orderedBook(4, "2026-11-20"),
      orderedBook(5, "2026-11-19"),
      orderedBook(6, "2026-11-18"),
      orderedBook(7, "2026-11-18"),
      orderedBook(8, null),
    ];
    const pageSize = HOME_DASHBOARD_RULES.activeBooks.pageSize;
    const firstPage = takeActiveBooksPage({ after: null, ordered, pageSize });
    const token =
      firstPage.nextCursor === null ? undefined : encodeActiveBookCursor(firstPage.nextCursor);

    const secondPage = takeActiveBooksPage({
      after: decodeActiveBookCursor(token),
      ordered,
      pageSize,
    });

    expect(secondPage.items.map((book) => book.id)).toEqual([uuidOf(7), uuidOf(8)]);
    expect(secondPage.nextCursor).toBeNull();
  });

  it("restarts from the first page when the cursor is malformed", () => {
    const ordered = [orderedBook(1, "2026-11-23"), orderedBook(2, "2026-11-22")];

    const page = takeActiveBooksPage({
      after: decodeActiveBookCursor("garbage"),
      ordered,
      pageSize: HOME_DASHBOARD_RULES.activeBooks.pageSize,
    });

    expect(page.items.map((book) => book.id)).toEqual([uuidOf(1), uuidOf(2)]);
  });
});
