import { describe, expect, it } from "vitest";

import { bookPageCeiling } from "./book-page-ceiling";

describe("bookPageCeiling", () => {
  it("caps the page at the book's page count when it is known", () => {
    expect(bookPageCeiling({ pagesCount: 300, technicalMax: 10000 })).toEqual({
      max: 300,
      source: "book",
    });
  });

  it("falls back to the technical maximum when the page count is unknown", () => {
    expect(bookPageCeiling({ pagesCount: null, technicalMax: 10000 })).toEqual({
      max: 10000,
      source: "technical",
    });
  });

  it("ignores a page count below one", () => {
    expect(bookPageCeiling({ pagesCount: 0, technicalMax: 10000 })).toEqual({
      max: 10000,
      source: "technical",
    });
  });
});
