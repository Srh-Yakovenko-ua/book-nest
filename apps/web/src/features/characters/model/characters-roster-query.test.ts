import { describe, expect, it } from "vitest";

import { sortRosterPage } from "./characters-roster-query";
import { makeCharacterSummary } from "./characters.fixtures";

describe("sortRosterPage recommended order", () => {
  it("places unspecified importance after every explicit importance", () => {
    const characters = [
      makeCharacterSummary({ characterId: "c-1", importance: "not_specified", name: "Аня" }),
      makeCharacterSummary({ characterId: "c-2", importance: "mentioned", name: "Богдан" }),
      makeCharacterSummary({ characterId: "c-3", importance: "central", name: "Василь" }),
    ];

    expect(sortRosterPage(characters, "recommended").map((entry) => entry.name)).toEqual([
      "Василь",
      "Богдан",
      "Аня",
    ]);
  });

  it("keeps favorites first even when their importance is unspecified", () => {
    const characters = [
      makeCharacterSummary({ characterId: "c-1", importance: "central", name: "Василь" }),
      makeCharacterSummary({
        characterId: "c-2",
        importance: "not_specified",
        isFavorite: true,
        name: "Аня",
      }),
    ];

    expect(sortRosterPage(characters, "recommended").map((entry) => entry.name)).toEqual([
      "Аня",
      "Василь",
    ]);
  });

  it("ignores importance when sorting by name", () => {
    const characters = [
      makeCharacterSummary({ characterId: "c-1", importance: "not_specified", name: "Аня" }),
      makeCharacterSummary({ characterId: "c-2", importance: "central", name: "Василь" }),
    ];

    expect(sortRosterPage(characters, "name").map((entry) => entry.name)).toEqual([
      "Аня",
      "Василь",
    ]);
  });
});
