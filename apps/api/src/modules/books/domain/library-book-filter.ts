import type { LibraryBooksQuery } from "@app/shared";

import type { LibraryFilter } from "../infrastructure/book-where.js";

type LibraryBookFilterInput = {
  query: LibraryBookFilterQuery;
  search: string | undefined;
  searchGenreKeys: string[] | undefined;
  userId: string;
};

type LibraryBookFilterQuery = Omit<LibraryBooksQuery, "pageNumber" | "pageSize" | "sort">;

export function buildLibraryBookFilter({
  query,
  search,
  searchGenreKeys,
  userId,
}: LibraryBookFilterInput): LibraryFilter {
  return {
    ageCategories: query.ageCategory,
    authorIds: query.author,
    bookType: query.bookType,
    formats: query.format,
    genreKeys: query.genre,
    hasActiveOrder: query.hasActiveOrder,
    hasCover: query.hasCover,
    hasDedication: query.hasDedication,
    hasRating: query.hasRating,
    inQueue: query.inQueue,
    isFavorite: query.isFavorite,
    languages: query.language,
    notInList: query.notInList,
    ownershipStatuses: query.owner,
    pagesMax: query.pagesMax,
    pagesMin: query.pagesMin,
    publisherIds: query.publisher,
    publisherPresence: query.publisherPresence,
    ratingMax: query.ratingMax,
    ratingMin: query.ratingMin,
    readingStatuses: query.status,
    search,
    searchGenreKeys,
    searchPublisher: query.searchPublisher,
    tagIds: query.tag,
    userId,
    yearMax: query.yearMax,
    yearMin: query.yearMin,
  };
}
