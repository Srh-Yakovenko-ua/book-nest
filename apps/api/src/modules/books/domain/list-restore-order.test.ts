import { describe, expect, it } from "vitest";

import { buildRestoredListOrder } from "./list-restore-order.js";

const BOOK = {
  a: "book-a",
  b: "book-b",
  c: "book-c",
  d: "book-d",
  e: "book-e",
  x: "book-x",
  y: "book-y",
  z: "book-z",
} as const;

describe("buildRestoredListOrder", () => {
  it("puts a book restored at position 2 of 5 second and shifts the books after it", () => {
    const order = buildRestoredListOrder({
      addedBookIds: [BOOK.b],
      currentBookIds: [BOOK.a, BOOK.c, BOOK.d, BOOK.e],
      restorePositions: [{ bookId: BOOK.b, position: 2 }],
    });

    expect(order).toEqual([BOOK.a, BOOK.b, BOOK.c, BOOK.d, BOOK.e]);
  });

  it("restores several books in ascending order of their old positions whatever the request order", () => {
    const order = buildRestoredListOrder({
      addedBookIds: [BOOK.d, BOOK.b],
      currentBookIds: [BOOK.a, BOOK.c, BOOK.e],
      restorePositions: [
        { bookId: BOOK.d, position: 4 },
        { bookId: BOOK.b, position: 2 },
      ],
    });

    expect(order).toEqual([BOOK.a, BOOK.b, BOOK.c, BOOK.d, BOOK.e]);
  });

  it("clamps a position past the end of the list to the last slot", () => {
    const order = buildRestoredListOrder({
      addedBookIds: [BOOK.x],
      currentBookIds: [BOOK.a, BOOK.b],
      restorePositions: [{ bookId: BOOK.x, position: 10 }],
    });

    expect(order).toEqual([BOOK.a, BOOK.b, BOOK.x]);
  });

  it("appends books without a restored position at the end in request order", () => {
    const order = buildRestoredListOrder({
      addedBookIds: [BOOK.x, BOOK.y, BOOK.z],
      currentBookIds: [BOOK.a, BOOK.b, BOOK.c],
      restorePositions: [{ bookId: BOOK.y, position: 1 }],
    });

    expect(order).toEqual([BOOK.y, BOOK.a, BOOK.b, BOOK.c, BOOK.x, BOOK.z]);
  });

  it("yields a dense 1..n order with every book once when restored positions skip slots", () => {
    const order = buildRestoredListOrder({
      addedBookIds: [BOOK.x, BOOK.y, BOOK.z],
      currentBookIds: [BOOK.a, BOOK.b],
      restorePositions: [
        { bookId: BOOK.x, position: 1 },
        { bookId: BOOK.y, position: 4 },
        { bookId: BOOK.z, position: 99 },
      ],
    });

    expect(order).toEqual([BOOK.x, BOOK.a, BOOK.b, BOOK.y, BOOK.z]);
  });
});
