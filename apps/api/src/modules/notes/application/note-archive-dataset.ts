import type { BookNotesFacetsQuery, SeriesNotesFacetsQuery } from "@app/shared";

import { normalizeSearch } from "@app/shared";

import type { BookNotesDataset } from "../infrastructure/book-notes-where.js";
import type { SeriesNotesDataset } from "../infrastructure/series-notes-sql.js";

export function toBookNotesDataset({
  query,
  userId,
}: {
  query: BookNotesFacetsQuery;
  userId: string;
}): BookNotesDataset {
  return {
    authorIds: query.author,
    bookIds: query.book,
    categories: query.category,
    customCategories: query.customCategory,
    hasChapter: query.hasChapter,
    hasPage: query.hasPage,
    search: normalizeSearch(query.search),
    userId,
  };
}

export function toSeriesNotesDataset({
  query,
  userId,
}: {
  query: SeriesNotesFacetsQuery;
  userId: string;
}): SeriesNotesDataset {
  return {
    authorIds: query.author,
    categories: query.category,
    customCategories: query.customCategory,
    genres: query.genre,
    readingStates: query.reading,
    search: normalizeSearch(query.search),
    seriesIds: query.series,
    statuses: query.status,
    userId,
  };
}
