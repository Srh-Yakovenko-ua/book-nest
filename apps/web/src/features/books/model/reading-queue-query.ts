import {
  type inferParserType,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import type { ReadingQueueControllerGetQueueParams } from "@/shared/api/generated/model";

import {
  ReadingQueueControllerGetQueueAgeCategoryItem,
  ReadingQueueControllerGetQueueBookType,
  ReadingQueueControllerGetQueueFormatItem,
  ReadingQueueControllerGetQueueLanguageItem,
  ReadingQueueControllerGetQueueOwnerItem,
  ReadingQueueControllerGetQueuePriorityItem,
  ReadingQueueControllerGetQueueStatusItem,
} from "@/shared/api/generated/model";

export const QUEUE_AGE_CATEGORY_VALUES = Object.values(
  ReadingQueueControllerGetQueueAgeCategoryItem,
);
export const QUEUE_BOOK_TYPE_VALUES = Object.values(ReadingQueueControllerGetQueueBookType);
export const QUEUE_FORMAT_VALUES = Object.values(ReadingQueueControllerGetQueueFormatItem);
export const QUEUE_LANGUAGE_VALUES = Object.values(ReadingQueueControllerGetQueueLanguageItem);
export const QUEUE_OWNER_VALUES = Object.values(ReadingQueueControllerGetQueueOwnerItem);
export const QUEUE_PRIORITY_FILTER_VALUES = Object.values(
  ReadingQueueControllerGetQueuePriorityItem,
);
export const QUEUE_STATUS_VALUES = Object.values(ReadingQueueControllerGetQueueStatusItem);

export const readingQueueQueryParsers = {
  ageCategory: parseAsArrayOf(parseAsStringLiteral(QUEUE_AGE_CATEGORY_VALUES)).withDefault([]),
  author: parseAsArrayOf(parseAsString).withDefault([]),
  bookType: parseAsStringLiteral(QUEUE_BOOK_TYPE_VALUES),
  format: parseAsArrayOf(parseAsStringLiteral(QUEUE_FORMAT_VALUES)).withDefault([]),
  genre: parseAsArrayOf(parseAsString).withDefault([]),
  hasCover: parseAsBoolean,
  language: parseAsArrayOf(parseAsStringLiteral(QUEUE_LANGUAGE_VALUES)).withDefault([]),
  owner: parseAsArrayOf(parseAsStringLiteral(QUEUE_OWNER_VALUES)).withDefault([]),
  pagesMax: parseAsInteger,
  pagesMin: parseAsInteger,
  priority: parseAsArrayOf(parseAsStringLiteral(QUEUE_PRIORITY_FILTER_VALUES)).withDefault([]),
  publisher: parseAsArrayOf(parseAsString).withDefault([]),
  q: parseAsString.withDefault(""),
  ratingMax: parseAsInteger,
  ratingMin: parseAsInteger,
  status: parseAsArrayOf(parseAsStringLiteral(QUEUE_STATUS_VALUES)).withDefault([]),
  tag: parseAsArrayOf(parseAsString).withDefault([]),
  yearMax: parseAsInteger,
  yearMin: parseAsInteger,
};

export type ReadingQueueQueryState = inferParserType<typeof readingQueueQueryParsers>;

export type ReadingQueueRangeFlags = {
  pages: boolean;
  rating: boolean;
  year: boolean;
};

export const READING_QUEUE_FILTERS_RESET = {
  ageCategory: null,
  author: null,
  bookType: null,
  format: null,
  genre: null,
  hasCover: null,
  language: null,
  owner: null,
  pagesMax: null,
  pagesMin: null,
  priority: null,
  publisher: null,
  ratingMax: null,
  ratingMin: null,
  status: null,
  tag: null,
  yearMax: null,
  yearMin: null,
};

export function countActiveReadingQueueFilters(state: ReadingQueueQueryState): number {
  const collections = [
    state.ageCategory,
    state.author,
    state.format,
    state.genre,
    state.language,
    state.owner,
    state.priority,
    state.publisher,
    state.status,
    state.tag,
  ];
  const singles = [state.bookType, state.hasCover];
  const ranges = [
    [state.pagesMin, state.pagesMax],
    [state.ratingMin, state.ratingMax],
    [state.yearMin, state.yearMax],
  ];

  return (
    collections.filter((value) => value.length > 0).length +
    singles.filter((value) => value !== null).length +
    ranges.filter(([min, max]) => min !== null || max !== null).length
  );
}

export function hasActiveReadingQueueFilters(state: ReadingQueueQueryState): boolean {
  return countActiveReadingQueueFilters(state) > 0;
}

export function hasActiveReadingQueueSearch(state: ReadingQueueQueryState): boolean {
  return state.q.trim() !== "";
}

export function isReadingQueueRangeValid(state: ReadingQueueQueryState): boolean {
  const flags = readingQueueRangeFlags(state);
  return !flags.pages && !flags.rating && !flags.year;
}

export function readingQueueRangeFlags(state: ReadingQueueQueryState): ReadingQueueRangeFlags {
  return {
    pages: isInvertedRange({ max: state.pagesMax, min: state.pagesMin }),
    rating: isInvertedRange({ max: state.ratingMax, min: state.ratingMin }),
    year: isInvertedRange({ max: state.yearMax, min: state.yearMin }),
  };
}

export function toReadingQueueParams(
  state: ReadingQueueQueryState,
): ReadingQueueControllerGetQueueParams {
  const flags = readingQueueRangeFlags(state);
  const search = state.q.trim();

  return {
    ageCategory: state.ageCategory,
    author: state.author,
    format: state.format,
    genre: state.genre,
    language: state.language,
    owner: state.owner,
    priority: state.priority,
    publisher: state.publisher,
    status: state.status,
    tag: state.tag,
    ...(state.bookType === null ? {} : { bookType: state.bookType }),
    ...(state.hasCover === null ? {} : { hasCover: String(state.hasCover) }),
    ...(search === "" ? {} : { q: search }),
    ...boundedRange({ flag: flags.pages, key: "pages", max: state.pagesMax, min: state.pagesMin }),
    ...boundedRange({
      flag: flags.rating,
      key: "rating",
      max: state.ratingMax,
      min: state.ratingMin,
    }),
    ...boundedRange({ flag: flags.year, key: "year", max: state.yearMax, min: state.yearMin }),
  };
}

function boundedRange({
  flag,
  key,
  max,
  min,
}: {
  flag: boolean;
  key: "pages" | "rating" | "year";
  max: null | number;
  min: null | number;
}): Record<string, number> {
  if (flag) return {};
  return {
    ...(min === null ? {} : { [`${key}Min`]: min }),
    ...(max === null ? {} : { [`${key}Max`]: max }),
  };
}

function isInvertedRange({ max, min }: { max: null | number; min: null | number }): boolean {
  return min !== null && max !== null && min > max;
}
