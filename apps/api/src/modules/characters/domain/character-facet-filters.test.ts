import { describe, expect, it } from "vitest";

import type { GlobalCharacterFilter } from "../infrastructure/characters.repository.js";
import type { CharacterFacetDimension } from "./character-facet-filters.js";

import { filtersExcludingOwnFacet } from "./character-facet-filters.js";

const FILTER: GlobalCharacterFilter = {
  archived: true,
  attitudes: ["like"],
  bookId: "11111111-1111-4111-8111-111111111111",
  contextBookId: "22222222-2222-4222-8222-222222222222",
  duplicateNormalizedNames: ["paul atreides"],
  favorite: true,
  genders: ["male"],
  groupIds: ["33333333-3333-4333-8333-333333333333"],
  hasPersonalImpression: false,
  hasSpoilers: true,
  importances: ["central"],
  includeSpoilerSearch: true,
  multipleBookCharacterIds: ["44444444-4444-4444-8444-444444444444"],
  roleTypes: ["antagonist"],
  search: "paul",
  seriesId: "55555555-5555-4555-8555-555555555555",
  speciesIds: ["66666666-6666-4666-8666-666666666666"],
  tagIds: ["77777777-7777-4777-8777-777777777777"],
  userId: "88888888-8888-4888-8888-888888888888",
};

const OWN_SELECTION: ReadonlyArray<[CharacterFacetDimension, keyof GlobalCharacterFilter]> = [
  ["attitude", "attitudes"],
  ["gender", "genders"],
  ["group", "groupIds"],
  ["importance", "importances"],
  ["role", "roleTypes"],
  ["species", "speciesIds"],
  ["tag", "tagIds"],
];

describe("filtersExcludingOwnFacet", () => {
  it.each(OWN_SELECTION)("clears the %s facet's own %s selection", (dimension, ownKey) => {
    const filters = filtersExcludingOwnFacet(FILTER);

    expect(filters[dimension][ownKey]).toBeUndefined();
  });

  it.each(OWN_SELECTION)(
    "keeps every other filter of the %s facet as given",
    (dimension, ownKey) => {
      const filters = filtersExcludingOwnFacet(FILTER);

      expect({ ...filters[dimension], [ownKey]: FILTER[ownKey] }).toEqual(FILTER);
    },
  );

  it("returns one filter per facet dimension", () => {
    const filters = filtersExcludingOwnFacet(FILTER);

    expect(Object.keys(filters).sort()).toEqual([
      "attitude",
      "gender",
      "group",
      "importance",
      "role",
      "species",
      "tag",
    ]);
  });

  it("leaves the input filter untouched", () => {
    const input = structuredClone(FILTER);

    filtersExcludingOwnFacet(input);

    expect(input).toEqual(FILTER);
  });
});
