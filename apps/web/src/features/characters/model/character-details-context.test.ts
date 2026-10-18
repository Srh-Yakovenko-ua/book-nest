import { describe, expect, it } from "vitest";

import { canonicalCharacterDetailsHref } from "./character-details-context";

describe("canonicalCharacterDetailsHref", () => {
  it("asks for no redirect when the URL carries no view", () => {
    expect(
      canonicalCharacterDetailsHref({
        characterId: "char-1",
        search: { bookId: "book-1", q: "silver", tab: "facts", view: null },
      }),
    ).toBeNull();
  });

  it("asks for no redirect on the explicit general profile", () => {
    expect(
      canonicalCharacterDetailsHref({
        characterId: "char-1",
        search: { bookId: null, q: "", tab: "facts", view: "global" },
      }),
    ).toBeNull();
  });

  it("drops a view that conflicts with the book and keeps the facts tab and search", () => {
    expect(
      canonicalCharacterDetailsHref({
        characterId: "char-1",
        search: { bookId: "book-1", q: "silver", tab: "facts", view: "global" },
      }),
    ).toBe("/characters/char-1?bookId=book-1&tab=facts&q=silver");
  });

  it("drops an unknown view into the smart context and keeps the facts tab and search", () => {
    expect(
      canonicalCharacterDetailsHref({
        characterId: "char-1",
        search: { bookId: null, q: "silver", tab: "facts", view: "unknown" },
      }),
    ).toBe("/characters/char-1?tab=facts&q=silver");
  });

  it("drops a conflicting view and keeps the relationships tab with its list state", () => {
    expect(
      canonicalCharacterDetailsHref({
        characterId: "char-1",
        search: {
          bookId: "book-1",
          q: "",
          relationshipSearch: new URLSearchParams({ relCat: "family,romance" }),
          tab: "relationships",
          view: "global",
        },
      }),
    ).toBe("/characters/char-1?bookId=book-1&tab=relationships&relCat=family%2Cromance");
  });

  it("drops an unknown view and keeps the relationships list state on the smart context", () => {
    expect(
      canonicalCharacterDetailsHref({
        characterId: "char-1",
        search: {
          bookId: null,
          q: "",
          relationshipSearch: new URLSearchParams({ relBook: "book-2" }),
          tab: "relationships",
          view: "unknown",
        },
      }),
    ).toBe("/characters/char-1?tab=relationships&relBook=book-2");
  });

  it("leaves the overview tab and an empty search out of the canonical path", () => {
    expect(
      canonicalCharacterDetailsHref({
        characterId: "char-1",
        search: { bookId: "book-1", q: "", tab: "overview", view: "global" },
      }),
    ).toBe("/characters/char-1?bookId=book-1");
  });
});
