import type {
  BookCharacterRelationshipsQuery,
  CharacterRelationshipContextView,
  CharacterRelationshipDetailsQuery,
  CharacterRelationshipDetailsView,
  SeriesCharacterRelationshipsQuery,
} from "@app/shared";

import { CHARACTER_RELATIONSHIP_ERROR_CODES, readingPositionFromQuery } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { RelationshipReadingContext } from "../domain/character-relationship-context.js";
import type { RelationshipDetailsRow } from "../infrastructure/character-relationships.repository.js";

import { BadRequestError, NotFoundError } from "../../../core/exceptions/errors.js";
import {
  buildContextViews,
  maskDetailsForContext,
} from "../domain/character-relationship-context.js";
import { toRelationshipDetailsView } from "../domain/character-relationship.mapper.js";
import { buildReadingPositionGate } from "../domain/reading-position.js";
import { resolveAllowedBookIds } from "../domain/series-representative.js";
import { CharacterRelationshipsRepository } from "../infrastructure/character-relationships.repository.js";
import { CharactersRepository } from "../infrastructure/characters.repository.js";
import { CharacterAccessAsserter } from "./character-access.asserter.js";

@Injectable()
export class RelationshipContextService {
  constructor(
    private readonly relationshipsRepository: CharacterRelationshipsRepository,
    private readonly charactersRepository: CharactersRepository,
    private readonly accessAsserter: CharacterAccessAsserter,
  ) {}

  async getDetails({
    query,
    relationshipId,
    userId,
  }: {
    query: CharacterRelationshipDetailsQuery;
    relationshipId: string;
    userId: string;
  }): Promise<CharacterRelationshipDetailsView> {
    const row = await this.relationshipsRepository.findOwnedRelationshipDetails({
      relationshipId,
      userId,
    });
    if (
      row === null ||
      row.sourceCharacter.hideProfileAsSpoiler ||
      row.targetCharacter.hideProfileAsSpoiler
    ) {
      throw new NotFoundError("Character relationship not found", {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.notFound,
      });
    }
    if (query.contextBookId === undefined) {
      return toRelationshipDetailsView({
        bookStates: row.bookStates,
        diagnostics: [],
        relationship: row,
      });
    }
    const context = await this.resolveBookContext({ contextBookId: query.contextBookId, userId });
    const positionGate = buildReadingPositionGate({
      contextBookId: query.contextBookId,
      reader: readingPositionFromQuery(query),
    });
    const masked = maskDetailsForContext({ context: { ...context, positionGate }, row });
    if (masked === null) {
      throw new NotFoundError("Character relationship not found", {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.notFound,
      });
    }
    return masked;
  }

  async listForBook({
    bookId,
    query,
    userId,
  }: {
    bookId: string;
    query: BookCharacterRelationshipsQuery;
    userId: string;
  }): Promise<CharacterRelationshipContextView[]> {
    await this.accessAsserter.assertBookOwned({
      bookId,
      notFoundCode: CHARACTER_RELATIONSHIP_ERROR_CODES.bookNotFound,
      userId,
    });
    const rows = await this.relationshipsRepository.listRelationshipsInBooks({
      bookIds: [bookId],
      userId,
    });
    return buildContextViews({
      context: {
        allowedBookIds: [bookId],
        partNumberById: new Map([[bookId, null]]),
        positionGate: buildReadingPositionGate({
          contextBookId: bookId,
          reader: readingPositionFromQuery(query),
        }),
      },
      includeHistory: query.includeHistory ?? false,
      rows,
    });
  }

  async listForSeries({
    query,
    seriesId,
    userId,
  }: {
    query: SeriesCharacterRelationshipsQuery;
    seriesId: string;
    userId: string;
  }): Promise<CharacterRelationshipContextView[]> {
    await this.accessAsserter.assertSeriesOwned({
      notFoundCode: CHARACTER_RELATIONSHIP_ERROR_CODES.bookContextInvalid,
      seriesId,
      userId,
    });
    const context = await this.resolveSeriesContext({
      contextBookId: query.contextBookId,
      seriesId,
      userId,
    });
    const positionGate =
      query.contextBookId === undefined
        ? null
        : buildReadingPositionGate({
            contextBookId: query.contextBookId,
            reader: readingPositionFromQuery(query),
          });
    const rows = await this.relationshipsRepository.listRelationshipsInBooks({
      bookIds: context.allowedBookIds,
      userId,
    });
    return buildContextViews({
      context: { ...context, positionGate },
      includeHistory: query.includeHistory ?? false,
      rows,
    });
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
      throw new NotFoundError("Character relationship not found", {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.notFound,
      });
    }
    return row;
  }

  private async resolveBookContext({
    contextBookId,
    userId,
  }: {
    contextBookId: string;
    userId: string;
  }): Promise<RelationshipReadingContext> {
    const contextBook = await this.charactersRepository.findOwnedBookContext({
      bookId: contextBookId,
      userId,
    });
    if (contextBook === null) {
      throw new NotFoundError("Book not found", {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.bookNotFound,
      });
    }
    if (contextBook.seriesId === null) {
      return {
        allowedBookIds: [contextBook.id],
        partNumberById: new Map([[contextBook.id, contextBook.partNumber]]),
      };
    }
    const seriesBooks = await this.charactersRepository.listSeriesBooks({
      seriesId: contextBook.seriesId,
      userId,
    });
    return {
      allowedBookIds: resolveAllowedBookIds({ contextBook, includeFuture: false, seriesBooks }),
      partNumberById: new Map(seriesBooks.map((book) => [book.id, book.partNumber])),
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
  }): Promise<RelationshipReadingContext> {
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
