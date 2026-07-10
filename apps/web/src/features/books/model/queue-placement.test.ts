import { describe, expect, it } from "vitest";

import {
  buildAddInput,
  buildMoveOrder,
  isQueuePlacementChoice,
  isQueueRelativeSide,
  maxQueuePosition,
} from "./queue-placement";

const BOOK = "book-new";

describe("maxQueuePosition", () => {
  it("allows one slot past the tail when adding", () => {
    expect(maxQueuePosition({ mode: "add", queueLength: 3 })).toBe(4);
  });

  it("keeps the size fixed when moving", () => {
    expect(maxQueuePosition({ mode: "move", queueLength: 3 })).toBe(3);
  });
});

describe("buildAddInput", () => {
  it("keeps a start placement", () => {
    expect(buildAddInput({ bookId: BOOK, choice: { placement: "start" }, queueLength: 3 })).toEqual(
      {
        bookId: BOOK,
        placement: "start",
      },
    );
  });

  it("keeps an end placement", () => {
    expect(buildAddInput({ bookId: BOOK, choice: { placement: "end" }, queueLength: 3 })).toEqual({
      bookId: BOOK,
      placement: "end",
    });
  });

  it("passes a specific position through", () => {
    expect(
      buildAddInput({
        bookId: BOOK,
        choice: { placement: "specific", position: 2 },
        queueLength: 3,
      }),
    ).toEqual({ bookId: BOOK, placement: "specific", position: 2 });
  });

  it("maps 'before' a book to that book's position", () => {
    expect(
      buildAddInput({
        bookId: BOOK,
        choice: { placement: "relative", relativePosition: 2, side: "before" },
        queueLength: 3,
      }),
    ).toEqual({ bookId: BOOK, placement: "specific", position: 2 });
  });

  it("maps 'after' a book to the next position", () => {
    expect(
      buildAddInput({
        bookId: BOOK,
        choice: { placement: "relative", relativePosition: 2, side: "after" },
        queueLength: 3,
      }),
    ).toEqual({ bookId: BOOK, placement: "specific", position: 3 });
  });

  it("always targets position 1 for an empty queue", () => {
    expect(buildAddInput({ bookId: BOOK, choice: { placement: "end" }, queueLength: 0 })).toEqual({
      bookId: BOOK,
      placement: "specific",
      position: 1,
    });
  });
});

describe("buildMoveOrder", () => {
  const ids = ["a", "b", "c", "d"];

  it("moves the book to the start", () => {
    expect(
      buildMoveOrder({ choice: { placement: "start" }, currentBookId: "c", orderedBookIds: ids }),
    ).toEqual(["c", "a", "b", "d"]);
  });

  it("moves the book to the end", () => {
    expect(
      buildMoveOrder({ choice: { placement: "end" }, currentBookId: "b", orderedBookIds: ids }),
    ).toEqual(["a", "c", "d", "b"]);
  });

  it("moves the book to a specific position", () => {
    expect(
      buildMoveOrder({
        choice: { placement: "specific", position: 2 },
        currentBookId: "d",
        orderedBookIds: ids,
      }),
    ).toEqual(["a", "d", "b", "c"]);
  });

  it("places the book before another book", () => {
    expect(
      buildMoveOrder({
        choice: { placement: "relative", relativeBookId: "b", side: "before" },
        currentBookId: "d",
        orderedBookIds: ids,
      }),
    ).toEqual(["a", "d", "b", "c"]);
  });

  it("places the book after another book", () => {
    expect(
      buildMoveOrder({
        choice: { placement: "relative", relativeBookId: "b", side: "after" },
        currentBookId: "d",
        orderedBookIds: ids,
      }),
    ).toEqual(["a", "b", "d", "c"]);
  });

  it("returns null when the relative target is missing", () => {
    expect(
      buildMoveOrder({
        choice: { placement: "relative", relativeBookId: "z", side: "after" },
        currentBookId: "d",
        orderedBookIds: ids,
      }),
    ).toBeNull();
  });
});

describe("guards", () => {
  it("recognises the four placement choices", () => {
    expect(isQueuePlacementChoice("relative")).toBe(true);
    expect(isQueuePlacementChoice("nope")).toBe(false);
  });

  it("recognises the two relative sides", () => {
    expect(isQueueRelativeSide("before")).toBe(true);
    expect(isQueueRelativeSide("sideways")).toBe(false);
  });
});
