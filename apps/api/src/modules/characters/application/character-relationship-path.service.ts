import type { CharacterRelationshipPathQuery, CharacterRelationshipPathView } from "@app/shared";

import {
  CHARACTER_PATH_MAX_VISITED_NODES,
  CHARACTER_RELATIONSHIP_ERROR_CODES,
  readingPositionFromQuery,
} from "@app/shared";
import { Injectable } from "@nestjs/common";

import { findVisibleRelationshipPath } from "../domain/character-relationship-path.js";
import {
  readerAllowedBookIds,
  readerPartNumberById,
} from "../domain/relationship-reader-projection.js";
import { CharacterRelationshipsRepository } from "../infrastructure/character-relationships.repository.js";
import { CharactersRepository } from "../infrastructure/characters.repository.js";
import { CharacterAccessAsserter } from "./character-access.asserter.js";
import {
  collectEndpointCharacterIds,
  toGraphEdgeSource,
  toGraphFilterSet,
  toGraphNodeSource,
} from "./graph-sources.js";
import { RelationshipReaderScopeResolver } from "./relationship-reader-scope.resolver.js";

@Injectable()
export class CharacterRelationshipPathService {
  constructor(
    private readonly relationshipsRepository: CharacterRelationshipsRepository,
    private readonly charactersRepository: CharactersRepository,
    private readonly accessAsserter: CharacterAccessAsserter,
    private readonly scopeResolver: RelationshipReaderScopeResolver,
  ) {}

  async findPath({
    query,
    userId,
  }: {
    query: CharacterRelationshipPathQuery;
    userId: string;
  }): Promise<CharacterRelationshipPathView> {
    await this.assertEndpointsOwned({ characterIds: [query.fromId, query.toId], userId });
    const context = await this.scopeResolver.resolveContextBook({
      contextBookId: query.contextBookId,
      reader: readingPositionFromQuery(query),
      userId,
    });
    const allowedBookIds = readerAllowedBookIds(context);
    const relationships = await this.relationshipsRepository.listRelationshipsInBooks({
      bookIds: allowedBookIds,
      userId,
    });
    const characterIds = [
      ...new Set([...collectEndpointCharacterIds(relationships), query.fromId, query.toId]),
    ];
    const nodeRows = await this.charactersRepository.listGraphNodes({
      bookIds: allowedBookIds,
      characterIds,
      userId,
    });

    return findVisibleRelationshipPath({
      categoryFilter: toGraphFilterSet(query.categories),
      edges: relationships.map(toGraphEdgeSource),
      fromId: query.fromId,
      maxVisitedNodes: CHARACTER_PATH_MAX_VISITED_NODES,
      mode: query.mode,
      nodes: nodeRows.map(toGraphNodeSource),
      partNumberById: readerPartNumberById(context),
      readerContext: context,
      revealEdgeIds: new Set(query.revealEdgeIds ?? []),
      toId: query.toId,
      typeFilter: toGraphFilterSet(query.relationshipTypes),
    });
  }

  private assertEndpointsOwned({
    characterIds,
    userId,
  }: {
    characterIds: string[];
    userId: string;
  }): Promise<void> {
    return this.accessAsserter.assertCharactersOwned({
      characterIds,
      notFoundCode: CHARACTER_RELATIONSHIP_ERROR_CODES.characterNotFound,
      userId,
    });
  }
}
