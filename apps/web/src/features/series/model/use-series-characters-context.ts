"use client";

import type { SeriesBookView } from "@app/shared";

import { useQueryState } from "nuqs";

import { useSeriesDefaultReadingContext } from "../api/use-series-default-reading-context";
import { findSeriesBook, SERIES_CHARACTERS_QUERY } from "./series-characters-query";

type SeriesCharactersContext =
  | { book: SeriesBookView; kind: "ready"; select: (bookId: string) => void }
  | { kind: "empty" }
  | { kind: "error"; retry: () => void }
  | { kind: "pending" };

export function useSeriesCharactersContext({
  books,
  seriesId,
}: {
  books: readonly SeriesBookView[];
  seriesId: string;
}): SeriesCharactersContext {
  const [selectedBookId, setSelectedBookId] = useQueryState(
    SERIES_CHARACTERS_QUERY.contextBook.urlKey,
    SERIES_CHARACTERS_QUERY.contextBook.parser,
  );
  const selectedBook = findSeriesBook({ bookId: selectedBookId, books });
  const defaultContext = useSeriesDefaultReadingContext({
    enabled: books.length > 0 && selectedBook === null,
    seriesId,
  });

  const [firstBook] = books;
  const select = (bookId: string) => void setSelectedBookId(bookId);

  if (firstBook === undefined) return { kind: "empty" };
  if (selectedBook !== null) return { book: selectedBook, kind: "ready", select };
  if (defaultContext.data !== undefined) {
    const defaultBook = findSeriesBook({ bookId: defaultContext.data.contextBookId, books });
    return { book: defaultBook ?? firstBook, kind: "ready", select };
  }
  if (defaultContext.isError && !defaultContext.isFetching) {
    return { kind: "error", retry: () => void defaultContext.refetch() };
  }
  return { kind: "pending" };
}
