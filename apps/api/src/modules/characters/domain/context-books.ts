import type { Nullable } from "@app/shared";

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
  const contextBook = await reader.findOwnedBookContext({ bookId: contextBookId, userId });
  if (contextBook === null) {
    throw new NotFoundError("Book not found", { code: notFoundCode });
  }
  if (contextBook.seriesId === null) {
    return [contextBook.id];
  }
  const seriesBooks = await reader.listSeriesBooks({ seriesId: contextBook.seriesId, userId });
  return resolveAllowedBookIds({ contextBook, includeFuture: false, seriesBooks });
}
