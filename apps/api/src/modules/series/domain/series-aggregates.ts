import type {
  AgeCategory,
  BookFormat,
  BookLanguage,
  Nullable,
  SeriesOwnership,
  TagView,
} from "@app/shared";

import {
  AgeCategorySchema,
  BookFormatSchema,
  BookLanguageSchema,
  ownershipStatusHoldsCopy,
  OwnershipStatusSchema,
} from "@app/shared";

import { UKRAINIAN_COLLATION } from "../../../core/ukrainian-collation.js";
import { computeAveragePages, computeAverageRating, computePagesCount } from "./series-stats.js";

export type SeriesAggregateBookRow = {
  ageCategory: string;
  formats: string[];
  isFavorite: boolean;
  language: string;
  ownershipStatus: string;
  pagesCount: Nullable<number>;
  readingProgress: Nullable<{ rating: Nullable<number> }>;
  tags: { tag: { id: string; name: string } }[];
};

export type SeriesBooksAggregates = {
  ageCategories: AgeCategory[];
  averagePages: Nullable<number>;
  averageRating: Nullable<number>;
  formats: BookFormat[];
  hasFavoriteBook: boolean;
  languages: BookLanguage[];
  ownership: SeriesOwnership;
  pagesCount: Nullable<number>;
  tags: TagView[];
};

export function summarizeSeriesAggregates(
  books: readonly SeriesAggregateBookRow[],
): SeriesBooksAggregates {
  return {
    ageCategories: collectInDeclaredOrder({
      declaredOrder: AgeCategorySchema.options,
      values: books.map((book) => AgeCategorySchema.parse(book.ageCategory)),
    }),
    averagePages: computeAveragePages(books),
    averageRating: computeAverageRating(
      books.map((book) => ({ rating: book.readingProgress?.rating ?? null })),
    ),
    formats: collectInDeclaredOrder({
      declaredOrder: BookFormatSchema.options,
      values: books.flatMap((book) => book.formats.map((format) => BookFormatSchema.parse(format))),
    }),
    hasFavoriteBook: books.some((book) => book.isFavorite),
    languages: collectInDeclaredOrder({
      declaredOrder: BookLanguageSchema.options,
      values: books.map((book) => BookLanguageSchema.parse(book.language)),
    }),
    ownership: countOwnership(books),
    pagesCount: computePagesCount(books),
    tags: collectTags(books),
  };
}

function collectInDeclaredOrder<Option extends string>({
  declaredOrder,
  values,
}: {
  declaredOrder: readonly Option[];
  values: readonly Option[];
}): Option[] {
  const present = new Set(values);
  return declaredOrder.filter((option) => present.has(option));
}

function collectTags(books: readonly Pick<SeriesAggregateBookRow, "tags">[]): TagView[] {
  const tagsById = new Map<string, TagView>();

  for (const book of books) {
    for (const bookTag of book.tags) {
      if (!tagsById.has(bookTag.tag.id)) {
        tagsById.set(bookTag.tag.id, { id: bookTag.tag.id, name: bookTag.tag.name });
      }
    }
  }

  return [...tagsById.values()].sort((first, second) =>
    UKRAINIAN_COLLATION.compare(first.name, second.name),
  );
}

function countOwnership(
  books: readonly Pick<SeriesAggregateBookRow, "ownershipStatus">[],
): SeriesOwnership {
  return {
    ownedCount: books.filter((book) =>
      ownershipStatusHoldsCopy(OwnershipStatusSchema.parse(book.ownershipStatus)),
    ).length,
    total: books.length,
  };
}
