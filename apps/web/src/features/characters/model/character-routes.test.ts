import { describe, expect, it } from "vitest";

import { CHARACTER_GLOBAL_VIEW, getCharacterDetailsPath } from "./character-routes";

describe("getCharacterDetailsPath", () => {
  it("leaves the overview tab out of the path", () => {
    expect(
      getCharacterDetailsPath({ bookId: "book-1", characterId: "char-1", tab: "overview" }),
    ).toBe("/characters/char-1?bookId=book-1");
  });

  it("builds a bare path for the smart context without a tab", () => {
    expect(getCharacterDetailsPath({ characterId: "char-1" })).toBe("/characters/char-1");
  });

  it("puts the facts tab after the book", () => {
    expect(getCharacterDetailsPath({ bookId: "book-1", characterId: "char-1", tab: "facts" })).toBe(
      "/characters/char-1?bookId=book-1&tab=facts",
    );
  });

  it("puts the facts tab after the general profile view", () => {
    expect(
      getCharacterDetailsPath({ characterId: "char-1", tab: "facts", view: CHARACTER_GLOBAL_VIEW }),
    ).toBe("/characters/char-1?view=global&tab=facts");
  });

  it("keeps the facts tab for the smart context", () => {
    expect(getCharacterDetailsPath({ characterId: "char-1", tab: "facts" })).toBe(
      "/characters/char-1?tab=facts",
    );
  });

  it("keeps a facts search after the tab", () => {
    expect(
      getCharacterDetailsPath({
        bookId: "book-1",
        characterId: "char-1",
        q: "silver",
        tab: "facts",
      }),
    ).toBe("/characters/char-1?bookId=book-1&tab=facts&q=silver");
  });

  it("encodes a search that contains reserved characters", () => {
    expect(getCharacterDetailsPath({ characterId: "char-1", q: "меч & кінь", tab: "facts" })).toBe(
      "/characters/char-1?tab=facts&q=%D0%BC%D0%B5%D1%87+%26+%D0%BA%D1%96%D0%BD%D1%8C",
    );
  });

  it("keeps the relationships tab and its list state after the facts search", () => {
    expect(
      getCharacterDetailsPath({
        bookId: "book-1",
        characterId: "char-1",
        q: "silver",
        relationshipSearch: new URLSearchParams({ relQ: "brother", relSort: "newest" }),
        tab: "relationships",
      }),
    ).toBe(
      "/characters/char-1?bookId=book-1&tab=relationships&q=silver&relQ=brother&relSort=newest",
    );
  });

  it("drops an empty search", () => {
    expect(
      getCharacterDetailsPath({ bookId: "book-1", characterId: "char-1", q: "", tab: "facts" }),
    ).toBe("/characters/char-1?bookId=book-1&tab=facts");
  });
});
