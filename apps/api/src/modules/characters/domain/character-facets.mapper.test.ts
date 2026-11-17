import { describe, expect, it } from "vitest";

import type { CharacterFacetCountRow } from "../infrastructure/character-facets.repository.js";
import type { CharacterFacetDimension } from "./character-facet-filters.js";

import { toCharacterFacetsView } from "./character-facets.mapper.js";

const GROUP_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GROUP_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const GROUP_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function emptyRows(): Record<CharacterFacetDimension, CharacterFacetCountRow[]> {
  return {
    attitude: [],
    gender: [],
    group: [],
    importance: [],
    role: [],
    species: [],
    tag: [],
  };
}

describe("toCharacterFacetsView", () => {
  it("sorts each facet by count descending, then by value ascending", () => {
    const view = toCharacterFacetsView({
      ...emptyRows(),
      gender: [
        { count: 1, value: "unknown" },
        { count: 3, value: "male" },
        { count: 3, value: "female" },
        { count: 2, value: "non_binary" },
      ],
    });

    expect(view.gender).toEqual([
      { count: 3, value: "female" },
      { count: 3, value: "male" },
      { count: 2, value: "non_binary" },
      { count: 1, value: "unknown" },
    ]);
  });

  it("sorts id facets the same way", () => {
    const view = toCharacterFacetsView({
      ...emptyRows(),
      group: [
        { count: 1, value: GROUP_C },
        { count: 4, value: GROUP_B },
        { count: 1, value: GROUP_A },
      ],
    });

    expect(view.group).toEqual([
      { count: 4, value: GROUP_B },
      { count: 1, value: GROUP_A },
      { count: 1, value: GROUP_C },
    ]);
  });

  it("keeps an empty facet empty", () => {
    const view = toCharacterFacetsView(emptyRows());

    expect(view).toEqual({
      attitude: [],
      gender: [],
      group: [],
      importance: [],
      role: [],
      species: [],
      tag: [],
    });
  });

  it.each<[CharacterFacetDimension, string]>([
    ["attitude", "favorite"],
    ["gender", "robot"],
    ["importance", "legendary"],
    ["role", "villain_of_the_week"],
  ])("throws when the %s facet holds the unknown value %s", (dimension, value) => {
    expect(() =>
      toCharacterFacetsView({ ...emptyRows(), [dimension]: [{ count: 1, value }] }),
    ).toThrow();
  });
});
