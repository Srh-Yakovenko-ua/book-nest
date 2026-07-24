import type { BookView, Nullable, QueuePriority, ReadingQueueItemView } from "@app/shared";

import type {
  BooksControllerListAgeCategoryItem,
  BooksControllerListBookType,
  BooksControllerListFormatItem,
  BooksControllerListLanguageItem,
  BooksControllerListOwnerItem,
  BooksControllerListStatusItem,
} from "@/shared/api/generated/model";

export const QUEUE_PRIORITY_VALUES = [
  "high",
  "normal",
  "low",
] as const satisfies readonly QueuePriority[];

export type QueueFilterState = {
  ageCategory: BooksControllerListAgeCategoryItem[];
  author: string[];
  bookType: Nullable<BooksControllerListBookType>;
  format: BooksControllerListFormatItem[];
  genre: string[];
  hasCover: Nullable<boolean>;
  language: BooksControllerListLanguageItem[];
  owner: BooksControllerListOwnerItem[];
  pagesMax: Nullable<number>;
  pagesMin: Nullable<number>;
  priority: QueuePriority[];
  publisher: string[];
  ratingMax: Nullable<number>;
  ratingMin: Nullable<number>;
  status: BooksControllerListStatusItem[];
  tag: string[];
  yearMax: Nullable<number>;
  yearMin: Nullable<number>;
};

export const EMPTY_QUEUE_FILTERS: QueueFilterState = {
  ageCategory: [],
  author: [],
  bookType: null,
  format: [],
  genre: [],
  hasCover: null,
  language: [],
  owner: [],
  pagesMax: null,
  pagesMin: null,
  priority: [],
  publisher: [],
  ratingMax: null,
  ratingMin: null,
  status: [],
  tag: [],
  yearMax: null,
  yearMin: null,
};

export function activeQueueFilterCount(state: QueueFilterState): number {
  let count = 0;
  if (state.status.length > 0) count += 1;
  if (state.owner.length > 0) count += 1;
  if (state.format.length > 0) count += 1;
  if (state.genre.length > 0) count += 1;
  if (state.tag.length > 0) count += 1;
  if (state.author.length > 0) count += 1;
  if (state.publisher.length > 0) count += 1;
  if (state.ageCategory.length > 0) count += 1;
  if (state.language.length > 0) count += 1;
  if (state.priority.length > 0) count += 1;
  if (state.bookType !== null) count += 1;
  if (state.hasCover !== null) count += 1;
  if (state.ratingMin !== null || state.ratingMax !== null) count += 1;
  if (state.yearMin !== null || state.yearMax !== null) count += 1;
  if (state.pagesMin !== null || state.pagesMax !== null) count += 1;
  return count;
}

export function hasActiveQueueFilters(state: QueueFilterState): boolean {
  return activeQueueFilterCount(state) > 0;
}

export function matchesQueueFilters(book: BookView, state: QueueFilterState): boolean {
  if (state.status.length > 0 && !state.status.includes(book.readingStatus)) return false;
  if (state.owner.length > 0 && !state.owner.includes(book.ownershipStatus)) return false;
  if (state.format.length > 0 && !state.format.some((value) => book.formats.includes(value)))
    return false;
  if (state.genre.length > 0 && !state.genre.some((value) => book.genres.includes(value)))
    return false;
  if (state.tag.length > 0 && !state.tag.some((id) => book.tags.some((tag) => tag.id === id)))
    return false;
  if (
    state.author.length > 0 &&
    !state.author.some((id) => book.authors.some((author) => author.id === id))
  )
    return false;
  if (state.publisher.length > 0) {
    if (book.publisher === null) return false;
    if (!state.publisher.includes(book.publisher.id)) return false;
  }
  if (state.ageCategory.length > 0 && !state.ageCategory.includes(book.ageCategory)) return false;
  if (state.language.length > 0 && !state.language.includes(book.language)) return false;
  if (state.bookType !== null && book.bookType !== state.bookType) return false;
  if (state.priority.length > 0) {
    if (book.queuePriority === null) return false;
    if (!state.priority.includes(book.queuePriority)) return false;
  }
  if (!matchesRange(book.readingProgress?.rating ?? null, state.ratingMin, state.ratingMax))
    return false;
  if (!matchesRange(book.publicationYear, state.yearMin, state.yearMax)) return false;
  if (!matchesRange(book.pagesCount, state.pagesMin, state.pagesMax)) return false;
  if (state.hasCover !== null && (book.cover != null) !== state.hasCover) return false;
  return true;
}

export function matchesQueueSearch(item: ReadingQueueItemView, query: string): boolean {
  const { book } = item;
  const haystack = [
    book.title,
    book.originalTitle ?? "",
    book.series?.name ?? "",
    ...book.authors.map((author) => author.name),
    ...book.genres,
    ...book.tags.map((tag) => tag.name),
  ];
  return haystack.some((part) => part.toLowerCase().includes(query));
}

function matchesRange(
  value: Nullable<number>,
  min: Nullable<number>,
  max: Nullable<number>,
): boolean {
  if (min !== null) {
    if (value === null) return false;
    if (value < min) return false;
  }
  if (max !== null) {
    if (value === null) return false;
    if (value > max) return false;
  }
  return true;
}
