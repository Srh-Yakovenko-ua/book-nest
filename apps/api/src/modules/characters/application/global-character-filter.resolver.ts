import type { CharacterFacetsQuery } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { GlobalCharacterFilter } from "../infrastructure/characters.repository.js";

import { toGlobalFilter } from "../domain/global-character-filter.js";
import { CharactersRepository } from "../infrastructure/characters.repository.js";
import { CharacterAccessAsserter } from "./character-access.asserter.js";

@Injectable()
export class GlobalCharacterFilterResolver {
  constructor(
    private readonly charactersRepository: CharactersRepository,
    private readonly accessAsserter: CharacterAccessAsserter,
  ) {}

  async resolve({
    query,
    userId,
  }: {
    query: CharacterFacetsQuery;
    userId: string;
  }): Promise<GlobalCharacterFilter> {
    if (query.contextBookId !== undefined) {
      await this.accessAsserter.assertBookOwned({ bookId: query.contextBookId, userId });
    }
    const [duplicateNormalizedNames, multipleBookCharacterIds] = await Promise.all([
      query.possibleDuplicates
        ? this.charactersRepository.findDuplicateNormalizedNames({
            archived: query.archived ?? false,
            userId,
          })
        : undefined,
      query.multipleBooks === true
        ? this.charactersRepository.listMultipleBookCharacterIds({ userId })
        : undefined,
    ]);
    return toGlobalFilter({ duplicateNormalizedNames, multipleBookCharacterIds, query, userId });
  }
}
