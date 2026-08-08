import type { CustomListBooksQuery } from "@app/shared";

import type { LibraryFilter } from "../infrastructure/book-where.js";

import { resolveListBookStatuses } from "./list-status-counts.js";

type ListBookFilterInput = {
  query: CustomListBooksQuery;
  search: string | undefined;
  searchGenreKeys: string[] | undefined;
  userId: string;
};

export function buildListBookFilter({
  query,
  search,
  searchGenreKeys,
  userId,
}: ListBookFilterInput): LibraryFilter {
  return {
    authorIds: query.author,
    bookType: query.bookType,
    formats: query.format,
    genreKeys: query.genre,
    hasRating: query.hasRating,
    inQueue: query.inQueue,
    isFavorite: query.isFavorite,
    ownershipStatuses: query.owner,
    pagesMax: query.pagesMax,
    pagesMin: query.pagesMin,
    ratingMax: query.ratingMax,
    ratingMin: query.ratingMin,
    readingStatuses: resolveListBookStatuses({ status: query.status, tab: query.tab }),
    search,
    searchGenreKeys,
    userId,
  };
}
