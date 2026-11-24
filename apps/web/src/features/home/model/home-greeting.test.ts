import { describe, expect, it } from "vitest";

import type { HomeSubtitleFacts } from "./home-greeting";

import { homeDisplayName, homeGreetingTone, homeSubtitleKey } from "./home-greeting";

function facts(overrides: Partial<HomeSubtitleFacts> = {}): HomeSubtitleFacts {
  return { activeBooksCount: 2, hasReadToday: false, libraryTotal: 40, ...overrides };
}

describe("homeDisplayName", () => {
  it("prefers the nickname over the name", () => {
    expect(homeDisplayName({ name: "Марина", nickname: "Мариша" })).toBe("Мариша");
  });

  it("uses the name when there is no nickname", () => {
    expect(homeDisplayName({ name: "Марина", nickname: null })).toBe("Марина");
  });

  it("treats a whitespace-only nickname as missing and uses the name", () => {
    expect(homeDisplayName({ name: "Марина", nickname: "   " })).toBe("Марина");
  });

  it("trims the surrounding whitespace of the chosen name", () => {
    expect(homeDisplayName({ name: "  Марина  ", nickname: null })).toBe("Марина");
  });

  it("returns no name when both the nickname and the name are blank", () => {
    expect(homeDisplayName({ name: " \t ", nickname: "" })).toBeNull();
  });

  it("returns no name when the user is not known", () => {
    expect(homeDisplayName(null)).toBeNull();
  });
});

describe("homeGreetingTone", () => {
  it("greets by the part of day when it is known", () => {
    expect(homeGreetingTone("evening")).toBe("evening");
  });

  it("falls back to a neutral greeting when the part of day is unknown", () => {
    expect(homeGreetingTone(null)).toBe("neutral");
  });
});

describe("homeSubtitleKey", () => {
  it("speaks about the empty library first, even when other facts are known", () => {
    expect(
      homeSubtitleKey(facts({ activeBooksCount: 0, hasReadToday: true, libraryTotal: 0 })),
    ).toBe("emptyLibrary");
  });

  it("mentions reading today ahead of the active books", () => {
    expect(homeSubtitleKey(facts({ activeBooksCount: 3, hasReadToday: true }))).toBe("readToday");
  });

  it("mentions the active books when nothing was read today", () => {
    expect(homeSubtitleKey(facts({ activeBooksCount: 3, hasReadToday: false }))).toBe(
      "activeBooks",
    );
  });

  it("mentions the lack of active books when none are in progress", () => {
    expect(homeSubtitleKey(facts({ activeBooksCount: 0, hasReadToday: false }))).toBe(
      "noActiveBooks",
    );
  });

  it("stays neutral when the library total is unknown, even if the reader read today", () => {
    expect(homeSubtitleKey(facts({ hasReadToday: true, libraryTotal: null }))).toBe("neutral");
  });

  it("stays neutral when reading today is unknown instead of falling to the active books", () => {
    expect(homeSubtitleKey(facts({ activeBooksCount: 3, hasReadToday: null }))).toBe("neutral");
  });

  it("stays neutral when the active books count is unknown", () => {
    expect(homeSubtitleKey(facts({ activeBooksCount: null, hasReadToday: false }))).toBe("neutral");
  });
});
