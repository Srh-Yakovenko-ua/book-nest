import { describe, expect, it } from "vitest";

import { initials } from "./initials";

describe("initials", () => {
  it("takes the first letters of the first and the last word", () => {
    expect(initials("Olena Ivanivna Petrenko")).toBe("OP");
  });

  it("uppercases the letters", () => {
    expect(initials("olena petrenko")).toBe("OP");
  });

  it("uppercases Cyrillic letters", () => {
    expect(initials("олена петренко")).toBe("ОП");
  });

  it("ignores extra whitespace around and between the words", () => {
    expect(initials("  Olena   Petrenko  ")).toBe("OP");
  });

  it("gives one letter for a single word", () => {
    expect(initials("Olena")).toBe("O");
  });

  it.each(["", "   "])("gives a question mark for %j", (name) => {
    expect(initials(name)).toBe("?");
  });
});
