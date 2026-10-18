import type {
  BookCharacterGraphQuery,
  CharacterGraphView,
  RelationshipCategory,
  RelationshipType,
  SeriesCharacterGraphQuery,
} from "@app/shared";

import {
  CHARACTER_GRAPH_EDGE_LIMIT,
  CHARACTER_GRAPH_NODE_LIMIT,
  readingPositionFromQuery,
} from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { RelationshipReaderContext } from "../domain/relationship-reader-projection.js";

import { buildCharacterGraph } from "../domain/character-graph.js";
import {
  readerAllowedBookIds,
  readerPartNumberById,
} from "../domain/relationship-reader-projection.js";
import { CharacterGroupsRepository } from "../infrastructure/character-groups.repository.js";
import { CharacterRelationshipsRepository } from "../infrastructure/character-relationships.repository.js";
import { CharactersRepository } from "../infrastructure/characters.repository.js";
import {
  collectEndpointCharacterIds,
  toGraphEdgeSource,
  toGraphFilterSet,
  toGraphMembershipSource,
  toGraphNodeSource,
} from "./graph-sources.js";
import { RelationshipReaderScopeResolver } from "./relationship-reader-scope.resolver.js";

@Injectable()
export class CharacterGraphService {
  constructor(
    private readonly relationshipsRepository: CharacterRelationshipsRepository,
    private readonly charactersRepository: CharactersRepository,
    private readonly groupsRepository: CharacterGroupsRepository,
    private readonly scopeResolver: RelationshipReaderScopeResolver,
  ) {}

  async getForBook({
    bookId,
    query,
    userId,
  }: {
    bookId: string;
    query: BookCharacterGraphQuery;
    userId: string;
  }): Promise<CharacterGraphView> {
    const context = await this.scopeResolver.resolveBook({
      bookId,
      reader: readingPositionFromQuery(query),
      userId,
    });
    return this.assembleGraph({ context, query, userId });
  }

  async getForSeries({
    query,
    seriesId,
    userId,
  }: {
    query: SeriesCharacterGraphQuery;
    seriesId: string;
    userId: string;
  }): Promise<CharacterGraphView> {
    const context = await this.scopeResolver.resolveSeries({
      contextBookId: query.contextBookId,
      reader: readingPositionFromQuery(query),
      seriesId,
      userId,
    });
    return this.assembleGraph({ context, query, userId });
  }

  private async assembleGraph({
    context,
    query,
    userId,
  }: {
    context: RelationshipReaderContext;
    query: BookCharacterGraphQuery;
    userId: string;
  }): Promise<CharacterGraphView> {
    const allowedBookIds = readerAllowedBookIds(context);
    const relationships = await this.relationshipsRepository.listRelationshipsInBooks({
      bookIds: allowedBookIds,
      userId,
    });
    const endpointIds = collectEndpointCharacterIds(relationships);
    const nodeRows = await this.charactersRepository.listGraphNodes({
      bookIds: allowedBookIds,
      characterIds: endpointIds,
      userId,
    });
    const clusterBy = query.clusterBy ?? null;
    const membershipRows =
      clusterBy === "group"
        ? await this.groupsRepository.listGraphMemberships({ characterIds: endpointIds, userId })
        : [];

    return buildCharacterGraph({
      allowedBookIds,
      categoryFilter: toGraphFilterSet<RelationshipCategory>(query.categories),
      clusterBy,
      depth: query.depth,
      edgeLimit: CHARACTER_GRAPH_EDGE_LIMIT,
      edges: relationships.map(toGraphEdgeSource),
      focusCharacterId: query.focusCharacterId ?? null,
      memberships: membershipRows.map(toGraphMembershipSource),
      mode: query.mode,
      nodeLimit: CHARACTER_GRAPH_NODE_LIMIT,
      nodes: nodeRows.map(toGraphNodeSource),
      partNumberById: readerPartNumberById(context),
      readerContext: context,
      revealEdgeIds: new Set(query.revealEdgeIds ?? []),
      typeFilter: toGraphFilterSet<RelationshipType>(query.relationshipTypes),
    });
  }
}
