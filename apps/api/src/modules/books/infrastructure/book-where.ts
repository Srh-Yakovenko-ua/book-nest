import type {
  AgeCategory,
  BookFormat,
  BookLanguage,
  BookType,
  OwnershipStatus,
  PublisherPresence,
  ReadingStatus,
} from "@app/shared";

import type { Prisma } from "../../../generated/prisma/client.js";

import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { buildBookSearchConditions } from "./book-search.js";

export type LibraryFilter = {
  ageCategories?: AgeCategory[];
  authorIds?: string[];
  bookType?: BookType;
  formats?: BookFormat[];
  genreKeys?: string[];
  hasCover?: boolean;
  hasDedication?: boolean;
  hasRating?: boolean;
  inQueue?: boolean;
  isFavorite?: boolean;
  languages?: BookLanguage[];
  notInList?: string;
  ownershipStatuses?: OwnershipStatus[];
  pagesMax?: number;
  pagesMin?: number;
  publisherIds?: string[];
  publisherPresence?: PublisherPresence;
  ratingMax?: number;
  ratingMin?: number;
  readingStatuses?: ReadingStatus[];
  search?: string;
  searchGenreKeys?: string[];
  tagIds?: string[];
  userId: string;
  yearMax?: number;
  yearMin?: number;
};

export function buildLibraryWhere(filter: LibraryFilter): Prisma.BookWhereInput {
  const where: Prisma.BookWhereInput = { ...SOFT_DELETE_SCOPE.active, userId: filter.userId };

  if (filter.readingStatuses !== undefined) {
    where.readingStatus = { in: filter.readingStatuses };
  }
  if (filter.ownershipStatuses !== undefined) {
    where.ownershipStatus = { in: filter.ownershipStatuses };
  }
  if (filter.formats !== undefined) {
    where.formats = { hasSome: filter.formats };
  }
  if (filter.genreKeys !== undefined) {
    where.genres = { hasSome: filter.genreKeys };
  }
  if (filter.tagIds !== undefined) {
    where.tags = { some: { tagId: { in: filter.tagIds } } };
  }
  if (filter.authorIds !== undefined) {
    where.authors = { some: { authorId: { in: filter.authorIds } } };
  }
  if (filter.publisherPresence === "missing") {
    where.publisherId = null;
  } else if (filter.publisherPresence === "assigned") {
    where.publisherId = { not: null };
  } else if (filter.publisherIds !== undefined) {
    where.publisherId = { in: filter.publisherIds };
  }
  if (filter.ageCategories !== undefined) {
    where.ageCategory = { in: filter.ageCategories };
  }
  if (filter.languages !== undefined) {
    where.language = { in: filter.languages };
  }
  if (filter.bookType === "solo") {
    where.seriesId = null;
  }
  if (filter.bookType === "series_part") {
    where.seriesId = { not: null };
  }
  if (filter.isFavorite !== undefined) {
    where.isFavorite = filter.isFavorite;
  }
  if (filter.inQueue === true) {
    where.queuePosition = { not: null };
  }
  if (filter.inQueue === false) {
    where.queuePosition = null;
  }
  if (filter.notInList !== undefined) {
    where.lists = { none: { listId: filter.notInList } };
  }
  if (filter.hasCover === true) {
    where.coverMediaId = { not: null };
  }
  if (filter.hasCover === false) {
    where.coverMediaId = null;
  }
  if (filter.hasDedication === false) {
    where.AND = [{ OR: [{ dedication: null }, { dedication: "" }] }];
  }
  if (filter.hasDedication === true) {
    where.AND = [{ AND: [{ dedication: { not: null } }, { dedication: { not: "" } }] }];
  }

  const rating = buildIntRange({ max: filter.ratingMax, min: filter.ratingMin });
  if (rating !== undefined) {
    where.readingProgress = { is: { rating } };
  } else if (filter.hasRating === true) {
    where.readingProgress = { is: { rating: { not: null } } };
  }
  if (filter.hasRating === false) {
    where.NOT = { readingProgress: { is: { rating: { not: null } } } };
  }
  const publicationYear = buildIntRange({ max: filter.yearMax, min: filter.yearMin });
  if (publicationYear !== undefined) {
    where.publicationYear = publicationYear;
  }
  const pagesCount = buildIntRange({ max: filter.pagesMax, min: filter.pagesMin });
  if (pagesCount !== undefined) {
    where.pagesCount = pagesCount;
  }

  const searchConditions = buildBookSearchConditions({
    search: filter.search,
    searchGenreKeys: filter.searchGenreKeys,
  });
  if (searchConditions !== undefined) {
    where.OR = searchConditions;
  }

  return where;
}

function buildIntRange({
  max,
  min,
}: {
  max?: number;
  min?: number;
}): undefined | { gte?: number; lte?: number } {
  if (min === undefined && max === undefined) {
    return undefined;
  }
  const range: { gte?: number; lte?: number } = {};
  if (min !== undefined) {
    range.gte = min;
  }
  if (max !== undefined) {
    range.lte = max;
  }
  return range;
}
