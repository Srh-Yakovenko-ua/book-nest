import { describe, expect, it } from "vitest";

import { noteLocationLine } from "./note-location";

const formatPage = (page: number) => `стор. ${page}`;

describe("noteLocationLine", () => {
  it("joins chapter and page", () => {
    expect(noteLocationLine({ chapter: "Розділ 12", page: 146 }, formatPage)).toBe(
      "Розділ 12 · стор. 146",
    );
  });

  it("returns the chapter alone", () => {
    expect(noteLocationLine({ chapter: "Розділ 12", page: null }, formatPage)).toBe("Розділ 12");
  });

  it("returns the page alone", () => {
    expect(noteLocationLine({ chapter: null, page: 146 }, formatPage)).toBe("стор. 146");
  });

  it("returns null when neither is set", () => {
    expect(noteLocationLine({ chapter: null, page: null }, formatPage)).toBeNull();
  });

  it("treats a blank chapter as missing", () => {
    expect(noteLocationLine({ chapter: "   ", page: null }, formatPage)).toBeNull();
    expect(noteLocationLine({ chapter: "  ", page: 87 }, formatPage)).toBe("стор. 87");
  });

  it("trims the chapter it renders", () => {
    expect(noteLocationLine({ chapter: "  Книга 2, фінал  ", page: null }, formatPage)).toBe(
      "Книга 2, фінал",
    );
  });
});
