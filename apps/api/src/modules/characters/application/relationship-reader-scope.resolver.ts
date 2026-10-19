import type { CharacterRelationshipDetailsQuery, Nullable, ReadingPosition } from "@app/shared";

import { CHARACTER_RELATIONSHIP_ERROR_CODES, readingPositionFromQuery } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type {
  ReaderBook,
  RelationshipReaderContext,
} from "../domain/relationship-reader-projection.js";
import type {
  BookContextRow,
  ReaderBookRow,
  SeriesMemberReadingContextRow,
  SeriesReadingContextBookRow,
} from "../infrastructure/characters.repository.js";

import { assertNever } from "../../../core/assert-never.js";
import { BadRequestError, NotFoundError } from "../../../core/exceptions/errors.js";
import { resolveReaderBookPosition } from "../domain/relationship-reader-projection.js";
import { warnOnAmbiguousSeriesOrder } from "../domain/series-order-warning.js";
import {
  resolveAllowedBookIds,
  resolveDefaultReadingContext,
} from "../domain/series-representative.js";
import { CharactersRepository } from "../infrastructure/characters.repository.js";
import { CharacterAccessAsserter } from "./character-access.asserter.js";

type ExplicitBookPosition = {
  bookId: string;
  reader: ReadingPosition | undefined;
};

type RelationshipParticipants = {
  bookStates: { bookId: string }[];
  sourceCharacterId: string;
  targetCharacterId: string;
};

@Injectable()
export class RelationshipReaderScopeResolver {
  constructor(
    private readonly charactersRepository: CharactersRepository,
    private readonly accessAsserter: CharacterAccessAsserter,
  ) {}

  async resolveBook({
    bookId,
    reader,
    userId,
  }: {
    bookId: string;
    reader: ReadingPosition | undefined;
    userId: string;
  }): Promise<RelationshipReaderContext> {
    const books = await this.loadReaderBooks({
      bookIds: [bookId],
      explicit: { bookId, reader },
      userId,
    });
    if (!books.has(bookId)) {
      throw new NotFoundError("Book not found", {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.bookNotFound,
      });
    }
    return { books, scope: { bookId, kind: "direct" } };
  }

  async resolveContextBook({
    contextBookId,
    reader,
    userId,
  }: {
    contextBookId: string;
    reader: ReadingPosition | undefined;
    userId: string;
  }): Promise<RelationshipReaderContext> {
    const contextBook = await this.charactersRepository.findOwnedBookContext({
      bookId: contextBookId,
      userId,
    });
    if (contextBook === null) {
      throw new NotFoundError("Book not found", {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.bookNotFound,
      });
    }
    const allowedBookIds = await this.resolveAllowedBookIdsOf({ contextBook, userId });
    const books = await this.loadReaderBooks({
      bookIds: allowedBookIds,
      explicit: { bookId: contextBookId, reader },
      userId,
    });
    return { books, scope: { contextBookId, kind: "as_of" } };
  }

  async resolveDetails({
    query,
    relationship,
    userId,
  }: {
    query: CharacterRelationshipDetailsQuery;
    relationship: RelationshipParticipants;
    userId: string;
  }): Promise<RelationshipReaderContext> {
    const reader = readingPositionFromQuery(query);
    if (query.scope === undefined || query.scopeId === undefined) {
      if (query.contextBookId !== undefined) {
        return this.resolveContextBook({ contextBookId: query.contextBookId, reader, userId });
      }
      return this.resolveGlobal({ bookIds: stateBookIdsOf(relationship), userId });
    }
    switch (query.scope) {
      case "book":
        return this.resolveBook({ bookId: query.scopeId, reader, userId });
      case "character":
        assertParticipant({ characterId: query.scopeId, relationship });
        if (query.contextBookId !== undefined) {
          return this.resolveBook({ bookId: query.contextBookId, reader, userId });
        }
        return this.resolveGlobal({ bookIds: stateBookIdsOf(relationship), userId });
      case "series":
        return this.resolveSeries({
          contextBookId: query.contextBookId,
          reader,
          seriesId: query.scopeId,
          userId,
        });
      default:
        return assertNever(query.scope);
    }
  }

  async resolveGlobal({
    bookIds,
    userId,
  }: {
    bookIds: string[];
    userId: string;
  }): Promise<RelationshipReaderContext> {
    const candidates = await this.charactersRepository.listOwnedReaderBooks({
      bookIds: [...new Set(bookIds)],
      userId,
    });
    const seriesIds = [
      ...new Set(
        candidates
          .map((book) => book.seriesId)
          .filter((seriesId): seriesId is string => seriesId !== null),
      ),
    ];
    const seriesMembers = await this.charactersRepository.listSeriesBooksReadingContextBySeries({
      seriesIds,
      userId,
    });
    const allowedSeriesBookIds = collectDefaultAllowedSeriesBookIds(seriesMembers);
    const books = new Map<string, ReaderBook>();
    for (const row of candidates) {
      if (row.seriesId === null || allowedSeriesBookIds.has(row.id)) {
        books.set(row.id, toReaderBook({ explicit: undefined, row }));
      }
    }
    return { books, scope: { kind: "global" } };
  }

  async resolveSeries({
    contextBookId,
    reader,
    seriesId,
    userId,
  }: {
    contextBookId: string | undefined;
    reader: ReadingPosition | undefined;
    seriesId: string;
    userId: string;
  }): Promise<RelationshipReaderContext> {
    await this.accessAsserter.assertSeriesOwned({
      notFoundCode: CHARACTER_RELATIONSHIP_ERROR_CODES.bookContextInvalid,
      seriesId,
      userId,
    });
    const seriesBooks = await this.charactersRepository.listSeriesBooksReadingContext({
      seriesId,
      userId,
    });
    warnOnAmbiguousSeriesOrder({ seriesBooks, seriesId });
    const contextBook =
      contextBookId === undefined
        ? pickDefaultContextBook(seriesBooks)
        : requireSeriesMember({ contextBookId, seriesBooks });
    if (contextBook === null) {
      return { books: new Map(), scope: { contextBookId: null, kind: "as_of" } };
    }
    const books = await this.loadReaderBooks({
      bookIds: resolveAllowedBookIds({ contextBook, includeFuture: false, seriesBooks }),
      explicit: contextBookId === undefined ? null : { bookId: contextBook.id, reader },
      userId,
    });
    return { books, scope: { contextBookId: contextBook.id, kind: "as_of" } };
  }

  private async loadReaderBooks({
    bookIds,
    explicit,
    userId,
  }: {
    bookIds: string[];
    explicit: Nullable<ExplicitBookPosition>;
    userId: string;
  }): Promise<Map<string, ReaderBook>> {
    const rows = await this.charactersRepository.listOwnedReaderBooks({ bookIds, userId });
    return new Map(
      rows.map((row) => [
        row.id,
        toReaderBook({
          explicit: explicit !== null && explicit.bookId === row.id ? explicit.reader : undefined,
          row,
        }),
      ]),
    );
  }

  private async resolveAllowedBookIdsOf({
    contextBook,
    userId,
  }: {
    contextBook: BookContextRow;
    userId: string;
  }): Promise<string[]> {
    if (contextBook.seriesId === null) {
      return [contextBook.id];
    }
    const seriesBooks = await this.charactersRepository.listSeriesBooks({
      seriesId: contextBook.seriesId,
      userId,
    });
    warnOnAmbiguousSeriesOrder({ seriesBooks, seriesId: contextBook.seriesId });
    return resolveAllowedBookIds({ contextBook, includeFuture: false, seriesBooks });
  }
}

function assertParticipant({
  characterId,
  relationship,
}: {
  characterId: string;
  relationship: RelationshipParticipants;
}): void {
  if (
    relationship.sourceCharacterId === characterId ||
    relationship.targetCharacterId === characterId
  ) {
    return;
  }
  throw new NotFoundError("Character relationship not found", {
    code: CHARACTER_RELATIONSHIP_ERROR_CODES.notFound,
  });
}

function collectDefaultAllowedSeriesBookIds(members: SeriesMemberReadingContextRow[]): Set<string> {
  const booksBySeries = new Map<string, SeriesMemberReadingContextRow[]>();
  for (const member of members) {
    if (member.seriesId === null) {
      continue;
    }
    const seriesBooks = booksBySeries.get(member.seriesId) ?? [];
    seriesBooks.push(member);
    booksBySeries.set(member.seriesId, seriesBooks);
  }
  const allowed = new Set<string>();
  for (const [seriesId, seriesBooks] of booksBySeries) {
    warnOnAmbiguousSeriesOrder({ seriesBooks, seriesId });
    const contextBook = pickDefaultContextBook(seriesBooks);
    if (contextBook === null) {
      continue;
    }
    for (const bookId of resolveAllowedBookIds({
      contextBook,
      includeFuture: false,
      seriesBooks,
    })) {
      allowed.add(bookId);
    }
  }
  return allowed;
}

function pickDefaultContextBook<Book extends SeriesReadingContextBookRow>(
  seriesBooks: Book[],
): Nullable<Book> {
  const defaultContext = resolveDefaultReadingContext({
    books: seriesBooks.map((book) => ({
      createdAt: book.createdAt,
      finishedAt: book.readingProgress?.finishedAt ?? null,
      id: book.id,
      partNumber: book.partNumber,
    })),
  });
  return seriesBooks.find((book) => book.id === defaultContext.contextBookId) ?? null;
}

function requireSeriesMember({
  contextBookId,
  seriesBooks,
}: {
  contextBookId: string;
  seriesBooks: SeriesReadingContextBookRow[];
}): SeriesReadingContextBookRow {
  const contextBook = seriesBooks.find((book) => book.id === contextBookId);
  if (contextBook === undefined) {
    throw new BadRequestError("The context book does not belong to this series", {
      code: CHARACTER_RELATIONSHIP_ERROR_CODES.bookContextInvalid,
    });
  }
  return contextBook;
}

function stateBookIdsOf(relationship: RelationshipParticipants): string[] {
  return relationship.bookStates.map((state) => state.bookId);
}

function toReaderBook({
  explicit,
  row,
}: {
  explicit: ReadingPosition | undefined;
  row: ReaderBookRow;
}): ReaderBook {
  return {
    id: row.id,
    partNumber: row.partNumber,
    position: resolveReaderBookPosition({ explicit, progress: row.readingProgress }),
    seriesId: row.seriesId,
    title: row.title,
  };
}
