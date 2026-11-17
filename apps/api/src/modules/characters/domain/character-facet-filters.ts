import type { CharacterFacetsView } from "@app/shared";

import type { GlobalCharacterFilter } from "../infrastructure/characters.repository.js";

export type CharacterFacetDimension = keyof CharacterFacetsView;

export function filtersExcludingOwnFacet(
  filter: GlobalCharacterFilter,
): Record<CharacterFacetDimension, GlobalCharacterFilter> {
  return {
    attitude: { ...filter, attitudes: undefined },
    gender: { ...filter, genders: undefined },
    group: { ...filter, groupIds: undefined },
    importance: { ...filter, importances: undefined },
    role: { ...filter, roleTypes: undefined },
    species: { ...filter, speciesIds: undefined },
    tag: { ...filter, tagIds: undefined },
  };
}
