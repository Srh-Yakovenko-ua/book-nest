import { describe, expect, it } from "vitest";

import { rankSpeciesMatches, SPECIES_QUERY_TUNING } from "./species-search.js";

function candidate(id: string, ...normalizedNames: string[]) {
  return { displayName: normalizedNames[0] ?? id, id, normalizedNames };
}

describe("rankSpeciesMatches", () => {
  it("orders exact, then prefix, then word-prefix, then contains", () => {
    const ranked = rankSpeciesMatches({
      candidates: [
        candidate("contains", "напівельфа"),
        candidate("word", "темний ельф"),
        candidate("prefix", "ельфійка"),
        candidate("exact", "ельф"),
        candidate("unrelated", "гном"),
      ],
      limit: 10,
      locale: "uk",
      normalizedQuery: "ельф",
    });

    expect(ranked.map((entry) => entry.id)).toEqual(["exact", "prefix", "word", "contains"]);
  });

  it("uses the best name of a species and breaks ties by the localized display name", () => {
    const ranked = rankSpeciesMatches({
      candidates: [
        candidate("wood", "лісовий ельф", "wood elf"),
        candidate("dark", "темний ельф", "dark elf"),
        candidate("high", "високий ельф", "high elf", "ельф-високий"),
      ],
      limit: 10,
      locale: "uk",
      normalizedQuery: "ельф",
    });

    expect(ranked.map((entry) => entry.id)).toEqual(["high", "wood", "dark"]);
  });

  it("caps the result at the limit, keeping the best-ranked species", () => {
    const ranked = rankSpeciesMatches({
      candidates: [candidate("b", "elfkin"), candidate("c", "dark elf"), candidate("a", "elf")],
      limit: 2,
      locale: "en",
      normalizedQuery: "elf",
    });

    expect(ranked.map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("keeps a curated popular list within the empty-query window", () => {
    expect(new Set(SPECIES_QUERY_TUNING.popularKeys).size).toBe(10);
  });
});
