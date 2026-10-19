import type {
  CharacterRelationshipListItemView,
  CharacterRelationshipListQuery,
  PaginatedCharacterRelationshipListView,
  ReadingPosition,
  SafeBookStateView,
  SafeParticipantView,
} from "@app/shared";

import { CHARACTER_RELATIONSHIP_ERROR_CODES, readingPositionFromQuery } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type {
  PermittedBookState,
  ReaderScope,
  RelationshipReaderContext,
  RelationshipReaderProjection,
  SafeParticipants,
} from "../domain/relationship-reader-projection.js";
import type { RelationshipListItemRow } from "../infrastructure/character-relationships-list.repository.js";

import { assertNever } from "../../../core/assert-never.js";
import { createLogger } from "../../../core/logger.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import {
  projectRelationshipForReader,
  toSafeBookStateView,
  toSafeRelationshipEdgeView,
} from "../domain/relationship-reader-projection.js";
import { CharacterRelationshipsListRepository } from "../infrastructure/character-relationships-list.repository.js";
import { CharacterAccessAsserter } from "./character-access.asserter.js";
import { CharacterViewMapper } from "./character-view.mapper.js";
import { RelationshipReaderScopeResolver } from "./relationship-reader-scope.resolver.js";

type ListParticipantRow = RelationshipListItemRow["sourceCharacter"];

const log = createLogger("character-relationships-list");

@Injectable()
export class CharacterRelationshipsListService {
  constructor(
    private readonly listRepository: CharacterRelationshipsListRepository,
    private readonly scopeResolver: RelationshipReaderScopeResolver,
    private readonly accessAsserter: CharacterAccessAsserter,
    private readonly viewMapper: CharacterViewMapper,
  ) {}

  async list({
    query,
    userId,
  }: {
    query: CharacterRelationshipListQuery;
    userId: string;
  }): Promise<PaginatedCharacterRelationshipListView> {
    const { pageNumber, pageSize } = query;
    const context = await this.resolveContext({ query, userId });
    if (context.scope.kind !== "global" && context.books.size === 0) {
      return buildPaginator({ items: [], pageNumber, pageSize, totalCount: 0 });
    }
    const { ids, totalCount } = await this.listRepository.searchVisible({
      ...pageSlice({ pageNumber, pageSize }),
      characterId: query.scope === "character" ? query.scopeId : null,
      filters: {
        bookId: query.bookId,
        categories: query.categories,
        intensities: query.intensities,
        isCanonical: query.isCanonical,
        q: query.q,
        relationshipTypes: query.relationshipTypes,
        statuses: query.statuses,
      },
      readerBooks: [...context.books.values()],
      scope: context.scope,
      sort: query.sort,
      userId,
    });
    const items = await this.hydrateItems({ context, ids, userId });
    return buildPaginator({ items, pageNumber, pageSize, totalCount });
  }

  private async hydrateItems({
    context,
    ids,
    userId,
  }: {
    context: RelationshipReaderContext;
    ids: string[];
    userId: string;
  }): Promise<CharacterRelationshipListItemView[]> {
    const rows = await this.listRepository.findReaderRelationships({ ids, userId });
    const rowsById = new Map(rows.map((row) => [row.id, row]));
    return ids.flatMap((relationshipId) => {
      const row = rowsById.get(relationshipId);
      if (row === undefined) {
        log.warn({ relationshipId }, "listed relationship disappeared before hydration");
        return [];
      }
      const projection = projectRelationshipForReader({ context, relationship: row });
      if (projection === null) {
        log.warn(
          { relationshipId, scope: context.scope.kind },
          "reader projection rejected a relationship accepted by the list query",
        );
        return [];
      }
      return [
        toListItemView({
          participants: {
            source: this.toParticipantView(row.sourceCharacter),
            target: this.toParticipantView(row.targetCharacter),
          },
          projection,
          relationship: row,
          scope: context.scope,
        }),
      ];
    });
  }

  private async resolveCharacterContext({
    characterId,
    contextBookId,
    reader,
    userId,
  }: {
    characterId: string;
    contextBookId: string | undefined;
    reader: ReadingPosition | undefined;
    userId: string;
  }): Promise<RelationshipReaderContext> {
    await this.accessAsserter.assertCharacterOwned({
      characterId,
      notFoundCode: CHARACTER_RELATIONSHIP_ERROR_CODES.characterNotFound,
      userId,
    });
    if (contextBookId !== undefined) {
      return this.scopeResolver.resolveBook({ bookId: contextBookId, reader, userId });
    }
    const bookIds = await this.listRepository.listStateBookIdsOfCharacterEdges({
      characterId,
      userId,
    });
    return this.scopeResolver.resolveGlobal({ bookIds, userId });
  }

  private resolveContext({
    query,
    userId,
  }: {
    query: CharacterRelationshipListQuery;
    userId: string;
  }): Promise<RelationshipReaderContext> {
    const reader = readingPositionFromQuery(query);
    switch (query.scope) {
      case "book":
        return this.scopeResolver.resolveBook({ bookId: query.scopeId, reader, userId });
      case "character":
        return this.resolveCharacterContext({
          characterId: query.scopeId,
          contextBookId: query.contextBookId,
          reader,
          userId,
        });
      case "series":
        return this.scopeResolver.resolveSeries({
          contextBookId: query.contextBookId,
          reader,
          seriesId: query.scopeId,
          userId,
        });
      default:
        return assertNever(query.scope);
    }
  }

  private toParticipantView(character: ListParticipantRow): SafeParticipantView {
    return {
      avatar: this.viewMapper.mediaViewOf(character.avatarMedia),
      id: character.id,
      name: character.name,
    };
  }
}

function toListItemView({
  participants,
  projection,
  relationship,
  scope,
}: {
  participants: SafeParticipants;
  projection: RelationshipReaderProjection;
  relationship: RelationshipListItemRow;
  scope: ReaderScope;
}): CharacterRelationshipListItemView {
  const toStateView = (permitted: PermittedBookState): SafeBookStateView =>
    toSafeBookStateView({ permitted, revealDescription: false, typeHidden: projection.typeHidden });
  return {
    bookSummaries: scope.kind === "global" ? projection.history.map(toStateView) : [],
    effectiveState: projection.effective === null ? null : toStateView(projection.effective),
    relationship: toSafeRelationshipEdgeView({
      participants,
      projection,
      relationship,
      revealType: false,
    }),
  };
}
