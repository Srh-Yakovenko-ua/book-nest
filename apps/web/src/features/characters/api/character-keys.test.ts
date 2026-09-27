import { describe, expect, it } from "vitest";

import { characterKeys } from "./character-keys";

const BOOK_ID = "3f7b0b7a-0a1a-4f0a-9b1a-0a1a4f0a9b1a";

describe("characterKeys.bookSummary", () => {
  it("separates two reading positions of the same book", () => {
    expect(characterKeys.bookSummary(BOOK_ID, { contextChapter: 5 })).not.toEqual(
      characterKeys.bookSummary(BOOK_ID, { contextChapter: 40 }),
    );
  });

  it("separates two context books of the same roster book", () => {
    expect(characterKeys.bookSummary(BOOK_ID, { contextBookId: "first" })).not.toEqual(
      characterKeys.bookSummary(BOOK_ID, { contextBookId: "second" }),
    );
  });

  it("stays stable for the same reading context", () => {
    expect(characterKeys.bookSummary(BOOK_ID, { contextPage: 12 })).toEqual(
      characterKeys.bookSummary(BOOK_ID, { contextPage: 12 }),
    );
  });
});
