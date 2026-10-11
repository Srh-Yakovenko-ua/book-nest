import { describe, expect, it } from "vitest";

import {
  findExactSpeciesMatch,
  findSimilarSpecies,
  isSimilarSpeciesName,
} from "./species-name-matching.js";
import { normalizeSpeciesName } from "./species-name-normalizer.js";

type TestCandidate = {
  id: string;
  normalizedNames: string[];
};

function candidate({ id, names }: { id: string; names: string[] }): TestCandidate {
  return { id, normalizedNames: names.map(normalizeSpeciesName) };
}

const CANDIDATES = [
  candidate({ id: "elf", names: ["Ельф", "Elf"] }),
  candidate({ id: "dark_elf", names: ["Темний ельф", "Dark elf"] }),
  candidate({ id: "fairy", names: ["Фея", "Fairy"] }),
  candidate({ id: "fae", names: ["Фейрі", "Fae"] }),
  candidate({ id: "werecreature", names: ["Перевертень", "Werecreature"] }),
  candidate({ id: "werewolf", names: ["Вовкулака", "Werewolf"] }),
  candidate({ id: "orc", names: ["Орк", "Orc"] }),
  candidate({ id: "human", names: ["Людина", "Human"] }),
  candidate({ id: "titan", names: ["Титан", "Titan"] }),
];

function exactIdFor(name: string): string | undefined {
  return findExactSpeciesMatch({
    candidates: CANDIDATES,
    normalizedName: normalizeSpeciesName(name),
  })?.id;
}

function similarIdsFor(name: string): string[] {
  return findSimilarSpecies({
    candidates: CANDIDATES,
    limit: 10,
    normalizedName: normalizeSpeciesName(name),
  }).map((match) => match.id);
}

describe("findExactSpeciesMatch", () => {
  it("matches any normalized label regardless of case, spacing or locale", () => {
    expect(exactIdFor("  ЕЛЬФ ")).toBe("elf");
    expect(exactIdFor("dark   ELF")).toBe("dark_elf");
    expect(exactIdFor("Werewolf")).toBe("werewolf");
  });

  it("returns null when nothing matches exactly", () => {
    expect(findExactSpeciesMatch({ candidates: CANDIDATES, normalizedName: "elves" })).toBeNull();
  });

  it("never treats a distinct people as an exact match", () => {
    expect(exactIdFor("Темний")).toBeUndefined();
    expect(exactIdFor("Werewolves")).toBeUndefined();
  });
});

describe("isSimilarSpeciesName", () => {
  it.each([
    ["ельф", "темний ельф"],
    ["elf", "dark elf"],
    ["fairy", "fae"],
    ["фея", "фейрі"],
    ["werewolf", "werecreature"],
    ["orc", "ork"],
    ["elf", "elves"],
  ])("treats %s and %s as advisory candidates", (left, right) => {
    expect(isSimilarSpeciesName({ left, right })).toBe(true);
    expect(isSimilarSpeciesName({ left: right, right: left })).toBe(true);
  });

  it.each([
    ["elf", "orc"],
    ["elf", "ent"],
    ["human", "titan"],
    ["human", "demon"],
  ])("does not pair unrelated %s and %s", (left, right) => {
    expect(isSimilarSpeciesName({ left, right })).toBe(false);
  });

  it("does not report an identical name as merely similar", () => {
    expect(isSimilarSpeciesName({ left: "elf", right: "elf" })).toBe(false);
  });

  it("ignores containment for names shorter than three characters", () => {
    expect(isSimilarSpeciesName({ left: "el", right: "dark elf" })).toBe(false);
  });
});

describe("findSimilarSpecies", () => {
  it("offers distinct peoples as candidates without the exact match", () => {
    expect(similarIdsFor("Ельф")).toEqual(["dark_elf"]);
    expect(similarIdsFor("Темний ельф")).toEqual(["elf"]);
  });

  it("offers fairy for fae and werecreature for werewolf", () => {
    expect(similarIdsFor("fae")).toEqual(["fairy"]);
    expect(similarIdsFor("werewolf")).toEqual(["werecreature"]);
  });

  it("finds candidates for a name that matches nothing exactly", () => {
    expect(similarIdsFor("Elves")).toEqual(["elf"]);
  });

  it("ranks the closest spelling first and honours the limit", () => {
    const candidates = [
      candidate({ id: "far", names: ["Elf of the far north"] }),
      candidate({ id: "close", names: ["Elfe"] }),
    ];

    expect(
      findSimilarSpecies({ candidates, limit: 1, normalizedName: "elf" }).map((match) => match.id),
    ).toEqual(["close"]);
  });

  it("returns nothing when no candidate is close", () => {
    expect(similarIdsFor("Dragon")).toEqual([]);
  });
});

describe("findSimilarSpecies bounded work", () => {
  const EDIT_DISTANCE_BUDGET = 200;
  const ids = (matches: readonly TestCandidate[]): string[] => matches.map((match) => match.id);

  it("accepts a close spelling exactly at the distance ratio and rejects one edit beyond it", () => {
    expect(isSimilarSpeciesName({ left: "abcde", right: "afghe" })).toBe(true);
    expect(isSimilarSpeciesName({ left: "abcde", right: "afghi" })).toBe(false);
  });

  it("never treats names whose lengths differ beyond the spelling cap as close spellings", () => {
    const longName = `e${"x".repeat(2000)}`;

    expect(isSimilarSpeciesName({ left: longName, right: "ex" })).toBe(false);
    expect(
      findSimilarSpecies({
        candidates: [candidate({ id: "short", names: ["ex"] })],
        limit: 5,
        normalizedName: longName,
      }),
    ).toEqual([]);
  });

  it("keeps ranking close spellings by edit distance", () => {
    const candidates = [
      candidate({ id: "elves", names: ["Elves"] }),
      candidate({ id: "elfin", names: ["Elfin"] }),
      candidate({ id: "elfe", names: ["Elfe"] }),
    ];

    expect(ids(findSimilarSpecies({ candidates, limit: 5, normalizedName: "elf" }))).toEqual([
      "elfe",
      "elfin",
      "elves",
    ]);
  });

  it("stays within the limit and stable when more names qualify than the edit-distance budget", () => {
    const candidates = Array.from({ length: EDIT_DISTANCE_BUDGET + 50 }, (_, index) =>
      candidate({ id: `kestral${index}`, names: [`kestral${index}`] }),
    ).reverse();
    const search = (): string[] =>
      ids(findSimilarSpecies({ candidates, limit: 5, normalizedName: "kestrel" }));

    expect(search()).toEqual(["kestral9", "kestral8", "kestral7", "kestral6", "kestral5"]);
    expect(search()).toEqual(search());
  });

  it("measures the closest lengths first and never spends the budget on contained names", () => {
    const sameLengthDecoys = Array.from({ length: EDIT_DISTANCE_BUDGET }, (_, index) =>
      candidate({ id: `decoy${index}`, names: [`k${String(index).padStart(6, "0")}`] }),
    );
    const candidates = [
      ...sameLengthDecoys,
      candidate({ id: "kastrel", names: ["Kastrel"] }),
      candidate({ id: "kestrin", names: ["Kestrin"] }),
      candidate({ id: "kestrels", names: ["Kestrels"] }),
    ];

    expect(ids(findSimilarSpecies({ candidates, limit: 5, normalizedName: "kestrel" }))).toEqual([
      "kestrels",
      "kestrin",
    ]);
  });

  it("ranks contained names by closeness however far apart their lengths are", () => {
    const candidates = [
      candidate({ id: "high_elf_warrior", names: ["High elf warrior"] }),
      candidate({ id: "dark_elf", names: ["Dark elf"] }),
      candidate({ id: "elfin", names: ["Elfin"] }),
    ];

    expect(ids(findSimilarSpecies({ candidates, limit: 5, normalizedName: "elf" }))).toEqual([
      "elfin",
      "dark_elf",
      "high_elf_warrior",
    ]);
  });
});
