import type { Nullable, SeriesBookView } from "@app/shared";

import { parseAsString } from "nuqs/server";

import type { SeriesCharactersControllerListParams } from "@/shared/api/generated/model";

export const SERIES_CHARACTERS_QUERY = {
  contextBook: { parser: parseAsString, urlKey: "charactersBookId" },
  search: { parser: parseAsString.withDefault(""), urlKey: "charactersSearch" },
} as const;

export function findSeriesBook({
  bookId,
  books,
}: {
  bookId: Nullable<string>;
  books: readonly SeriesBookView[];
}): Nullable<SeriesBookView> {
  if (bookId === null) return null;
  return books.find((book) => book.id === bookId) ?? null;
}

export function seriesBooksAsOf({
  books,
  contextBook,
}: {
  books: readonly SeriesBookView[];
  contextBook: SeriesBookView;
}): SeriesBookView[] {
  const contextPart = contextBook.partNumber;
  if (contextPart === null) return [contextBook];
  return books.filter(
    (book) =>
      book.id === contextBook.id || (book.partNumber !== null && book.partNumber < contextPart),
  );
}

export function seriesContextBooks(books: readonly SeriesBookView[]): SeriesBookView[] {
  return [...books].sort(compareReadingOrder);
}

export function toSeriesCastParams({
  contextBookId,
  search,
}: {
  contextBookId: string;
  search: string;
}): SeriesCharactersControllerListParams {
  const q = search.trim();
  return q.length === 0 ? { contextBookId } : { contextBookId, q };
}

function compareReadingOrder(left: SeriesBookView, right: SeriesBookView): number {
  if (left.partNumber === right.partNumber) return 0;
  if (left.partNumber === null) return 1;
  if (right.partNumber === null) return -1;
  return left.partNumber - right.partNumber;
}
