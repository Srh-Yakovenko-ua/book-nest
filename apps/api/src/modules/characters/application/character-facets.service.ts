import type { CharacterFacetsQuery, CharacterFacetsView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { filtersExcludingOwnFacet } from "../domain/character-facet-filters.js";
import { toCharacterFacetsView } from "../domain/character-facets.mapper.js";
import { CharacterFacetsRepository } from "../infrastructure/character-facets.repository.js";
import { GlobalCharacterFilterResolver } from "./global-character-filter.resolver.js";

@Injectable()
export class CharacterFacetsService {
  constructor(
    private readonly facetsRepository: CharacterFacetsRepository,
    private readonly filterResolver: GlobalCharacterFilterResolver,
  ) {}

  async facets({
    query,
    userId,
  }: {
    query: CharacterFacetsQuery;
    userId: string;
  }): Promise<CharacterFacetsView> {
    const filters = filtersExcludingOwnFacet(await this.filterResolver.resolve({ query, userId }));

    const [attitude, gender, group, importance, role, species, tag] = await Promise.all([
      this.facetsRepository.countByAttitude(filters.attitude),
      this.facetsRepository.countByGender(filters.gender),
      this.facetsRepository.countByGroup(filters.group),
      this.facetsRepository.countByImportance(filters.importance),
      this.facetsRepository.countByRole(filters.role),
      this.facetsRepository.countBySpecies(filters.species),
      this.facetsRepository.countByTag(filters.tag),
    ]);

    return toCharacterFacetsView({ attitude, gender, group, importance, role, species, tag });
  }
}
