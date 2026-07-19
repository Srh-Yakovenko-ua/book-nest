import type { CharacterRelationshipPathQuery, CharacterRelationshipPathView } from "@app/shared";

import { CHARACTER_PATH_MAX_VISITED_NODES, CHARACTER_RELATIONSHIP_ERROR_CODES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { ResolvedReadingContext } from "../domain/context-books.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { findVisibleRelationshipPath } from "../domain/character-relationship-path.js";
import { resolveReadingContext } from "../domain/context-books.js";
import { CharacterRelationshipsRepository } from "../infrastructure/character-relationships.repository.js";
import { CharactersRepository } from "../infrastructure/characters.repository.js";
import {
  collectEndpointCharacterIds,
  toGraphEdgeSource,
  toGraphFilterSet,
  toGraphNodeSource,
} from "./graph-sources.js";

@Injectable()
export class CharacterRelationshipPathService {
  constructor(
    private readonly relationshipsRepository: CharacterRelationshipsRepository,
    private readonly charactersRepository: CharactersRepository,
  ) {}

  async findPath({
    query,
    userId,
  }: {
    query: CharacterRelationshipPathQuery;
    userId: string;
  }): Promise<CharacterRelationshipPathView> {
    await this.assertEndpointsOwned({ characterIds: [query.fromId, query.toId], userId });
    const context = await this.resolveContext({ contextBookId: query.contextBookId, userId });
    const relationships = await this.relationshipsRepository.listRelationshipsInBooks({
      bookIds: context.allowedBookIds,
      userId,
    });
    const characterIds = [
      ...new Set([...collectEndpointCharacterIds(relationships), query.fromId, query.toId]),
    ];
    const nodeRows = await this.charactersRepository.listGraphNodes({
      bookIds: context.allowedBookIds,
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
      partNumberById: context.partNumberById,
      revealEdgeIds: new Set(query.revealEdgeIds ?? []),
      toId: query.toId,
      typeFilter: toGraphFilterSet(query.relationshipTypes),
    });
  }

  private async assertEndpointsOwned({
    characterIds,
    userId,
  }: {
    characterIds: string[];
    userId: string;
  }): Promise<void> {
    const uniqueIds = [...new Set(characterIds)];
    const owned = await this.relationshipsRepository.countOwnedCharacters({
      characterIds: uniqueIds,
      userId,
    });
    if (owned !== uniqueIds.length) {
      throw new NotFoundError("Character not found", {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.characterNotFound,
      });
    }
  }

  private async resolveContext({
    contextBookId,
    userId,
  }: {
    contextBookId: string | undefined;
    userId: string;
  }): Promise<ResolvedReadingContext> {
    if (contextBookId === undefined) {
      const books = await this.charactersRepository.listOwnedBooks({ userId });
      return {
        allowedBookIds: books.map((book) => book.id),
        partNumberById: new Map(books.map((book) => [book.id, book.partNumber])),
      };
    }
    return resolveReadingContext({
      contextBookId,
      notFoundCode: CHARACTER_RELATIONSHIP_ERROR_CODES.bookNotFound,
      reader: this.charactersRepository,
      userId,
    });
  }
}
