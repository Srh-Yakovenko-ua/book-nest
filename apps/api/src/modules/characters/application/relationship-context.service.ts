import type {
  BookCharacterRelationshipsQuery,
  CharacterRelationshipDetailsQuery,
  CharacterRelationshipDetailsView,
  CharacterRelationshipSafeContextView,
  CharacterRelationshipSafeDetailsView,
  SafeParticipantView,
  SeriesCharacterRelationshipsQuery,
} from "@app/shared";

import { CHARACTER_RELATIONSHIP_ERROR_CODES, readingPositionFromQuery } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { RelationshipReaderContext } from "../domain/relationship-reader-projection.js";
import type {
  ReaderRelationshipDetailsRow,
  RelationshipDetailsRow,
} from "../infrastructure/character-relationships.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { toRelationshipDetailsView } from "../domain/character-relationship.mapper.js";
import {
  isPermittedBookState,
  projectRelationshipForReader,
  readerAllowedBookIds,
  toSafeRelationshipContextView,
  toSafeRelationshipDetailsView,
} from "../domain/relationship-reader-projection.js";
import { CharacterRelationshipsRepository } from "../infrastructure/character-relationships.repository.js";
import { CharacterViewMapper } from "./character-view.mapper.js";
import { RelationshipReaderScopeResolver } from "./relationship-reader-scope.resolver.js";

type ReaderParticipantRow = ReaderRelationshipDetailsRow["sourceCharacter"];

@Injectable()
export class RelationshipContextService {
  constructor(
    private readonly relationshipsRepository: CharacterRelationshipsRepository,
    private readonly scopeResolver: RelationshipReaderScopeResolver,
    private readonly viewMapper: CharacterViewMapper,
  ) {}

  async getDetails({
    query,
    relationshipId,
    userId,
  }: {
    query: CharacterRelationshipDetailsQuery;
    relationshipId: string;
    userId: string;
  }): Promise<CharacterRelationshipSafeDetailsView> {
    const row = await this.relationshipsRepository.findOwnedReaderRelationship({
      relationshipId,
      userId,
    });
    if (row === null) {
      throw relationshipNotFound();
    }
    const context = await this.scopeResolver.resolveDetails({ query, relationship: row, userId });
    const projection = projectRelationshipForReader({ context, relationship: row });
    if (projection === null) {
      throw relationshipNotFound();
    }
    const descriptionBookStateId = query.revealDescriptionBookStateId ?? null;
    if (
      descriptionBookStateId !== null &&
      !isPermittedBookState({ bookStateId: descriptionBookStateId, projection })
    ) {
      throw new NotFoundError("Relationship book state not found", {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.bookStateNotFound,
      });
    }
    return toSafeRelationshipDetailsView({
      participants: {
        source: this.toParticipantView(row.sourceCharacter),
        target: this.toParticipantView(row.targetCharacter),
      },
      projection,
      relationship: row,
      reveal: { descriptionBookStateId, type: query.revealType ?? false },
    });
  }

  async getEditableDetails({
    relationshipId,
    userId,
  }: {
    relationshipId: string;
    userId: string;
  }): Promise<CharacterRelationshipDetailsView> {
    const row = await this.relationshipsRepository.findOwnedRelationshipDetails({
      relationshipId,
      userId,
    });
    if (row === null) {
      throw relationshipNotFound();
    }
    return toRelationshipDetailsView({
      bookStates: row.bookStates,
      diagnostics: [],
      relationship: row,
    });
  }

  async listForBook({
    bookId,
    query,
    userId,
  }: {
    bookId: string;
    query: BookCharacterRelationshipsQuery;
    userId: string;
  }): Promise<CharacterRelationshipSafeContextView[]> {
    const context = await this.scopeResolver.resolveBook({
      bookId,
      reader: readingPositionFromQuery(query),
      userId,
    });
    return this.listInContext({ context, includeHistory: query.includeHistory ?? false, userId });
  }

  async listForSeries({
    query,
    seriesId,
    userId,
  }: {
    query: SeriesCharacterRelationshipsQuery;
    seriesId: string;
    userId: string;
  }): Promise<CharacterRelationshipSafeContextView[]> {
    const context = await this.scopeResolver.resolveSeries({
      contextBookId: query.contextBookId,
      reader: readingPositionFromQuery(query),
      seriesId,
      userId,
    });
    return this.listInContext({ context, includeHistory: query.includeHistory ?? false, userId });
  }

  async loadDetails(
    { relationshipId, userId }: { relationshipId: string; userId: string },
    tx: Prisma.TransactionClient,
  ): Promise<RelationshipDetailsRow> {
    const row = await this.relationshipsRepository.findOwnedRelationshipDetails(
      { relationshipId, userId },
      tx,
    );
    if (row === null) {
      throw relationshipNotFound();
    }
    return row;
  }

  private async listInContext({
    context,
    includeHistory,
    userId,
  }: {
    context: RelationshipReaderContext;
    includeHistory: boolean;
    userId: string;
  }): Promise<CharacterRelationshipSafeContextView[]> {
    const rows = await this.relationshipsRepository.listRelationshipsInBooks({
      bookIds: readerAllowedBookIds(context),
      userId,
    });
    return rows.flatMap((row) => {
      const projection = projectRelationshipForReader({ context, relationship: row });
      if (projection === null) {
        return [];
      }
      return [toSafeRelationshipContextView({ includeHistory, projection, relationship: row })];
    });
  }

  private toParticipantView(character: ReaderParticipantRow): SafeParticipantView {
    return {
      avatar: this.viewMapper.mediaViewOf(character.avatarMedia),
      id: character.id,
      name: character.name,
    };
  }
}

function relationshipNotFound(): NotFoundError {
  return new NotFoundError("Character relationship not found", {
    code: CHARACTER_RELATIONSHIP_ERROR_CODES.notFound,
  });
}
