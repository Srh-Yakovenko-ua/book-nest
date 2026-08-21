import { describe, expect, it } from "vitest";

import { UKRAINIAN_COLLATION } from "./ukrainian-collation.js";

const UKRAINIAN_ALPHABET = {
  mixedScripts: ["Zorro", "Яблуко", "the Hobbit", "Аркан"],
  mixedScriptsSorted: ["Аркан", "Яблуко", "the Hobbit", "Zorro"],
  titlesInCodepointOrder: [
    "Єва",
    "Ігри",
    "Їжак",
    "Аркан",
    "Бездоганний",
    "Гарний",
    "Едем",
    "Зима",
    "Йорж",
    "Яблуко",
    "Ґудзик",
  ],
  titlesInUkrainianOrder: [
    "Аркан",
    "Бездоганний",
    "Гарний",
    "Ґудзик",
    "Едем",
    "Єва",
    "Зима",
    "Ігри",
    "Їжак",
    "Йорж",
    "Яблуко",
  ],
} as const;

describe("UKRAINIAN_COLLATION.compare", () => {
  it("orders the alphabet with Ґ after Г, Є after Е and І between З and Й", () => {
    const sorted = [...UKRAINIAN_ALPHABET.titlesInCodepointOrder].sort(UKRAINIAN_COLLATION.compare);

    expect(sorted).toEqual(UKRAINIAN_ALPHABET.titlesInUkrainianOrder);
  });

  it("orders Latin after Cyrillic", () => {
    const sorted = [...UKRAINIAN_ALPHABET.mixedScripts].sort(UKRAINIAN_COLLATION.compare);

    expect(sorted).toEqual(UKRAINIAN_ALPHABET.mixedScriptsSorted);
  });

  it("differs from a locale-less localeCompare on a mixed Cyrillic and Latin set", () => {
    const byCollator = [...UKRAINIAN_ALPHABET.mixedScripts].sort(UKRAINIAN_COLLATION.compare);
    const byLocaleless = [...UKRAINIAN_ALPHABET.mixedScripts].sort((left, right) =>
      left.localeCompare(right),
    );

    expect(
      byLocaleless,
      "a locale-less localeCompare sorts Latin ahead of Cyrillic — if it now matches the collator, the collator has been simplified away",
    ).not.toEqual(byCollator);
  });
});
