import type { CustomListBooksQuery } from "@app/shared";

import type { LibraryFilter } from "../infrastructure/book-where.js";

import { resolveListBookStatuses } from "./list-quick-counts.js";

type ListBookFilterInput = {
  query: CustomListBooksQuery;
  search: string | undefined;
  searchGenreKeys: string[] | undefined;
  userId: string;
};

const QUICK_FILTER_AXES = ["bookType", "inQueue", "isFavorite", "readingStatuses"] as const;

export type QuickFilterAxis = (typeof QUICK_FILTER_AXES)[number];

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

export function clearQuickFilterAxes(filter: LibraryFilter): LibraryFilter {
  const cleared: LibraryFilter = { ...filter };
  for (const axis of QUICK_FILTER_AXES) {
    delete cleared[axis];
  }
  return cleared;
}

export function hasQuickFilterAxis(filter: LibraryFilter): boolean {
  return QUICK_FILTER_AXES.some((axis) => filter[axis] !== undefined);
}
