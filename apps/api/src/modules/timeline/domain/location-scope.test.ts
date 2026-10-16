import { describe, expect, it } from "vitest";

import { resolveLocationScope } from "./location-scope.js";

const BOOK_ID = "22222222-2222-4222-8222-222222222222";
const SERIES_ID = "33333333-3333-4333-8333-333333333333";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "44444444-4444-4444-8444-444444444444";

describe("resolveLocationScope", () => {
  it("scopes to the book itself when the book has no series", () => {
    expect(resolveLocationScope({ bookId: BOOK_ID, series: null, userId: USER_ID })).toEqual({
      bookId: BOOK_ID,
      kind: "book",
    });
  });

  it("scopes to the book itself when its series is in the trash", () => {
    expect(
      resolveLocationScope({
        bookId: BOOK_ID,
        series: {
          deletedAt: new Date("2026-03-01T00:00:00.000Z"),
          id: SERIES_ID,
          userId: USER_ID,
        },
        userId: USER_ID,
      }),
    ).toEqual({ bookId: BOOK_ID, kind: "book" });
  });

  it("scopes to the owner's series when the book belongs to an active series", () => {
    expect(
      resolveLocationScope({
        bookId: BOOK_ID,
        series: { deletedAt: null, id: SERIES_ID, userId: USER_ID },
        userId: USER_ID,
      }),
    ).toEqual({ kind: "series", seriesId: SERIES_ID, userId: USER_ID });
  });

  it("scopes to the book itself when its series belongs to another user", () => {
    expect(
      resolveLocationScope({
        bookId: BOOK_ID,
        series: { deletedAt: null, id: SERIES_ID, userId: OTHER_USER_ID },
        userId: USER_ID,
      }),
    ).toEqual({ bookId: BOOK_ID, kind: "book" });
  });
});
