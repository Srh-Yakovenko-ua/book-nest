import type {
  BookCharacterGraphQuery,
  CharacterGraphView,
  FamilyTreeGraphView,
  RelationshipCategory,
  RelationshipType,
  SeriesCharacterGraphQuery,
} from "@app/shared";

import {
  CHARACTER_GRAPH_EDGE_LIMIT,
  CHARACTER_GRAPH_NODE_LIMIT,
  CHARACTER_RELATIONSHIP_ERROR_CODES,
  FAMILY_TREE_GENERATIONS,
  readingPositionFromQuery,
} from "@app/shared";
import { Injectable } from "@nestjs/common";

import type {
  GraphCapPolicy,
  GraphEdgeSource,
  GraphNodeSource,
} from "../domain/character-graph.js";
import type { RelationshipReaderContext } from "../domain/relationship-reader-projection.js";

import { buildCharacterGraph } from "../domain/character-graph.js";
import { buildFamilyTreeGraph } from "../domain/family-tree.js";
import {
  readerAllowedBookIds,
  readerPartNumberById,
} from "../domain/relationship-reader-projection.js";
import { CharacterGroupsRepository } from "../infrastructure/character-groups.repository.js";
import { CharacterRelationshipsRepository } from "../infrastructure/character-relationships.repository.js";
import { CharactersRepository } from "../infrastructure/characters.repository.js";
import { CharacterAccessAsserter } from "./character-access.asserter.js";
import { CharacterViewMapper } from "./character-view.mapper.js";
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
    private readonly accessAsserter: CharacterAccessAsserter,
    private readonly viewMapper: CharacterViewMapper,
  ) {}

  async getForBook({
    bookId,
    query,
    userId,
  }: {
    bookId: string;
    query: BookCharacterGraphQuery;
    userId: string;
  }): Promise<CharacterGraphView | FamilyTreeGraphView> {
    const context = await this.scopeResolver.resolveBook({
      bookId,
      reader: readingPositionFromQuery(query),
      userId,
    });
    const focusCharacterId = query.focusCharacterId;
    if (focusCharacterId !== undefined) {
      await this.accessAsserter.assertCharacterInBook({
        bookId,
        characterId: focusCharacterId,
        notFoundCode: CHARACTER_RELATIONSHIP_ERROR_CODES.characterNotFound,
        userId,
      });
    }
    if (query.projection === "family_tree" && focusCharacterId !== undefined) {
      return this.assembleFamilyTree({
        ancestors: query.ancestors ?? FAMILY_TREE_GENERATIONS.default,
        context,
        descendants: query.descendants ?? FAMILY_TREE_GENERATIONS.default,
        focusCharacterId,
        userId,
      });
    }
    return this.assembleGraph({ capPolicy: "connected", context, query, userId });
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
    return this.assembleGraph({ capPolicy: "legacy", context, query, userId });
  }

  private async assembleFamilyTree({
    ancestors,
    context,
    descendants,
    focusCharacterId,
    userId,
  }: {
    ancestors: number;
    context: RelationshipReaderContext;
    descendants: number;
    focusCharacterId: string;
    userId: string;
  }): Promise<FamilyTreeGraphView> {
    const { edges, nodes } = await this.loadGraphSources({
      context,
      extraCharacterIds: [focusCharacterId],
      userId,
    });
    return buildFamilyTreeGraph({
      ancestors,
      descendants,
      edgeLimit: CHARACTER_GRAPH_EDGE_LIMIT,
      edges,
      focusCharacterId,
      nodeLimit: CHARACTER_GRAPH_NODE_LIMIT,
      nodes,
      partNumberById: readerPartNumberById(context),
      readerContext: context,
    });
  }

  private async assembleGraph({
    capPolicy,
    context,
    query,
    userId,
  }: {
    capPolicy: GraphCapPolicy;
    context: RelationshipReaderContext;
    query: BookCharacterGraphQuery | SeriesCharacterGraphQuery;
    userId: string;
  }): Promise<CharacterGraphView> {
    const focusCharacterId = query.focusCharacterId ?? null;
    const { edges, nodes } = await this.loadGraphSources({
      context,
      extraCharacterIds:
        capPolicy === "connected" && focusCharacterId !== null ? [focusCharacterId] : [],
      userId,
    });
    const clusterBy = query.clusterBy ?? null;
    const membershipRows =
      clusterBy === "group"
        ? await this.groupsRepository.listGraphMemberships({
            characterIds: nodes.map((node) => node.id),
            userId,
          })
        : [];

    return buildCharacterGraph({
      allowedBookIds: readerAllowedBookIds(context),
      capPolicy,
      categoryFilter: toGraphFilterSet<RelationshipCategory>(query.categories),
      clusterBy,
      depth: query.depth,
      edgeLimit: CHARACTER_GRAPH_EDGE_LIMIT,
      edges,
      focusCharacterId,
      memberships: membershipRows.map(toGraphMembershipSource),
      mode: query.mode,
      nodeLimit: CHARACTER_GRAPH_NODE_LIMIT,
      nodes,
      partNumberById: readerPartNumberById(context),
      readerContext: context,
      revealEdgeIds: new Set(query.revealEdgeIds ?? []),
      typeFilter: toGraphFilterSet<RelationshipType>(query.relationshipTypes),
    });
  }

  private async loadGraphSources({
    context,
    extraCharacterIds,
    userId,
  }: {
    context: RelationshipReaderContext;
    extraCharacterIds: string[];
    userId: string;
  }): Promise<{ edges: GraphEdgeSource[]; nodes: GraphNodeSource[] }> {
    const allowedBookIds = readerAllowedBookIds(context);
    const relationships = await this.relationshipsRepository.listRelationshipsInBooks({
      bookIds: allowedBookIds,
      userId,
    });
    const characterIds = [
      ...new Set([...collectEndpointCharacterIds(relationships), ...extraCharacterIds]),
    ];
    const nodeRows = await this.charactersRepository.listGraphNodes({
      bookIds: allowedBookIds,
      characterIds,
      userId,
    });
    const mediaViewOf = this.viewMapper.mediaViewOf.bind(this.viewMapper);
    return {
      edges: relationships.map(toGraphEdgeSource),
      nodes: nodeRows.map((node) => toGraphNodeSource({ mediaViewOf, node })),
    };
  }
}
