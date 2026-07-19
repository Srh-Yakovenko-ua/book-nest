import type { Nullable } from "@app/shared";

import type { ReadingPositionGate } from "./reading-position.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { resolveAllowedBookIds } from "./series-representative.js";

export type ContextBookReader = {
  findOwnedBookContext(args: {
    bookId: string;
    userId: string;
  }): Promise<Nullable<{ id: string; partNumber: Nullable<number>; seriesId: Nullable<string> }>>;
  listSeriesBooks(args: {
    seriesId: string;
    userId: string;
  }): Promise<{ id: string; partNumber: Nullable<number> }[]>;
};

export type ResolvedReadingContext = {
  allowedBookIds: string[];
  partNumberById: Map<string, Nullable<number>>;
  positionGate?: Nullable<ReadingPositionGate>;
};

export async function resolveContextAllowedBookIds({
  contextBookId,
  notFoundCode,
  reader,
  userId,
}: {
  contextBookId: string;
  notFoundCode: string;
  reader: ContextBookReader;
  userId: string;
}): Promise<string[]> {
  const context = await resolveReadingContext({ contextBookId, notFoundCode, reader, userId });
  return context.allowedBookIds;
}

export async function resolveReadingContext({
  contextBookId,
  notFoundCode,
  reader,
  userId,
}: {
  contextBookId: string;
  notFoundCode: string;
  reader: ContextBookReader;
  userId: string;
}): Promise<ResolvedReadingContext> {
  const contextBook = await reader.findOwnedBookContext({ bookId: contextBookId, userId });
  if (contextBook === null) {
    throw new NotFoundError("Book not found", { code: notFoundCode });
  }
  if (contextBook.seriesId === null) {
    return {
      allowedBookIds: [contextBook.id],
      partNumberById: new Map([[contextBook.id, contextBook.partNumber]]),
    };
  }
  const seriesBooks = await reader.listSeriesBooks({ seriesId: contextBook.seriesId, userId });
  return {
    allowedBookIds: resolveAllowedBookIds({ contextBook, includeFuture: false, seriesBooks }),
    partNumberById: new Map(seriesBooks.map((book) => [book.id, book.partNumber])),
  };
}
