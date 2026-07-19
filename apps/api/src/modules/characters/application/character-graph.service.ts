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
  CHARACTER_RELATIONSHIP_ERROR_CODES,
} from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { ResolvedReadingContext } from "../domain/context-books.js";

import { BadRequestError, NotFoundError } from "../../../core/exceptions/errors.js";
import { buildCharacterGraph } from "../domain/character-graph.js";
import { resolveAllowedBookIds } from "../domain/series-representative.js";
import { CharacterRelationshipsRepository } from "../infrastructure/character-relationships.repository.js";
import { CharactersRepository } from "../infrastructure/characters.repository.js";
import {
  collectEndpointCharacterIds,
  toGraphEdgeSource,
  toGraphFilterSet,
  toGraphNodeSource,
} from "./graph-sources.js";

@Injectable()
export class CharacterGraphService {
  constructor(
    private readonly relationshipsRepository: CharacterRelationshipsRepository,
    private readonly charactersRepository: CharactersRepository,
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
    const context = await this.resolveBookContext({ bookId, userId });
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
    const context = await this.resolveSeriesContext({
      contextBookId: query.contextBookId,
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
    context: ResolvedReadingContext;
    query: BookCharacterGraphQuery;
    userId: string;
  }): Promise<CharacterGraphView> {
    const relationships = await this.relationshipsRepository.listRelationshipsInBooks({
      bookIds: context.allowedBookIds,
      userId,
    });
    const endpointIds = collectEndpointCharacterIds(relationships);
    const nodeRows = await this.charactersRepository.listGraphNodes({
      bookIds: context.allowedBookIds,
      characterIds: endpointIds,
      userId,
    });

    return buildCharacterGraph({
      categoryFilter: toGraphFilterSet<RelationshipCategory>(query.categories),
      depth: query.depth,
      edgeLimit: CHARACTER_GRAPH_EDGE_LIMIT,
      edges: relationships.map(toGraphEdgeSource),
      focusCharacterId: query.focusCharacterId ?? null,
      mode: query.mode,
      nodeLimit: CHARACTER_GRAPH_NODE_LIMIT,
      nodes: nodeRows.map(toGraphNodeSource),
      partNumberById: context.partNumberById,
      revealEdgeIds: new Set(query.revealEdgeIds ?? []),
      typeFilter: toGraphFilterSet<RelationshipType>(query.relationshipTypes),
    });
  }

  private async resolveBookContext({
    bookId,
    userId,
  }: {
    bookId: string;
    userId: string;
  }): Promise<ResolvedReadingContext> {
    const contextBook = await this.charactersRepository.findOwnedBookContext({ bookId, userId });
    if (contextBook === null) {
      throw new NotFoundError("Book not found", {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.bookNotFound,
      });
    }
    return {
      allowedBookIds: [contextBook.id],
      partNumberById: new Map([[contextBook.id, contextBook.partNumber]]),
    };
  }

  private async resolveSeriesContext({
    contextBookId,
    seriesId,
    userId,
  }: {
    contextBookId: string | undefined;
    seriesId: string;
    userId: string;
  }): Promise<ResolvedReadingContext> {
    const owns = await this.charactersRepository.existsOwnedSeries({ seriesId, userId });
    if (!owns) {
      throw new NotFoundError("Series not found", {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.bookContextInvalid,
      });
    }
    const seriesBooks = await this.charactersRepository.listSeriesBooks({ seriesId, userId });
    const partNumberById = new Map(seriesBooks.map((book) => [book.id, book.partNumber]));
    if (contextBookId === undefined) {
      return { allowedBookIds: seriesBooks.map((book) => book.id), partNumberById };
    }
    const contextBook = seriesBooks.find((book) => book.id === contextBookId);
    if (contextBook === undefined) {
      throw new BadRequestError("The context book does not belong to this series", {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.bookContextInvalid,
      });
    }
    return {
      allowedBookIds: resolveAllowedBookIds({ contextBook, includeFuture: false, seriesBooks }),
      partNumberById,
    };
  }
}
