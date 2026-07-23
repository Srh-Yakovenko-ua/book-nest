import type {
  MediaView,
  Nullable,
  SeriesBookView,
  SeriesDetailsView,
  SeriesView,
} from "@app/shared";

import {
  AgeCategorySchema,
  BookFormatsSchema,
  BookGenresSchema,
  OwnershipStatusSchema,
  ReadingStatusSchema,
  SeriesStatusSchema,
} from "@app/shared";

import type { SeriesWithDetails } from "../infrastructure/series.repository.js";
import type { SeriesBookRow } from "./series-preview.js";

import {
  compareByPartThenCreated,
  computeSeriesLastActivityAt,
  summarizeSeriesBooks,
  toSeriesBookPreview,
} from "./series-preview.js";
import { computeSeriesStats } from "./series-stats.js";

type SeriesAuthorRef = { id: string; name: string };

type SeriesDetailBook = SeriesWithDetails["books"][number];

type SeriesViewBookRow = SeriesBookRow & {
  authors: { author: SeriesAuthorRef; position: number }[];
};

type SeriesViewSource = {
  _count: { books: number };
  authors: { author: SeriesAuthorRef }[];
  books: SeriesViewBookRow[];
  createdAt: Date;
  description: Nullable<string>;
  genres: string[];
  id: string;
  name: string;
  status: string;
  totalBooks: Nullable<number>;
  updatedAt: Date;
};

export function toSeriesDetailsView(
  series: SeriesWithDetails,
  covers: Map<string, Nullable<MediaView>>,
): SeriesDetailsView {
  const orderedBooks = [...series.books].sort(compareByPartThenCreated);
  const books = orderedBooks.map((book) => toSeriesBookView(book, covers.get(book.id) ?? null));

  return {
    ...toSeriesView(series),
    books,
    publishers: collectSeriesPublishers(series.books),
    stats: computeSeriesStats(series.books.map(toStatsBook)),
  };
}

export function toSeriesView(series: SeriesViewSource): SeriesView {
  const books = series.books.map(toSeriesBookPreview);
  const { finishedInSeries, nextBook, readingInSeries } = summarizeSeriesBooks(books);

  return {
    authors: resolveSeriesAuthors(series),
    booksInSeries: series._count.books,
    createdAt: series.createdAt.toISOString(),
    description: series.description,
    finishedInSeries,
    genres: series.genres,
    id: series.id,
    lastActivityAt: computeSeriesLastActivityAt({
      books,
      seriesUpdatedAt: series.updatedAt,
    }).toISOString(),
    name: series.name,
    nextBook,
    readingInSeries,
    status: SeriesStatusSchema.parse(series.status),
    totalBooks: series.totalBooks,
  };
}

function collectSeriesPublishers(
  books: SeriesWithDetails["books"],
): { id: string; name: string }[] {
  const publishersById = new Map<string, { id: string; name: string }>();

  for (const book of books) {
    if (book.publisher !== null) {
      publishersById.set(book.publisher.id, {
        id: book.publisher.id,
        name: book.publisher.name,
      });
    }
  }

  return Array.from(publishersById.values()).sort((first, second) =>
    first.name.localeCompare(second.name),
  );
}

function resolveSeriesAuthors(series: {
  authors: { author: SeriesAuthorRef }[];
  books: SeriesViewBookRow[];
}): SeriesAuthorRef[] {
  if (series.books.length === 0) {
    return series.authors.map(({ author }) => ({ id: author.id, name: author.name }));
  }

  const authorsById = new Map<string, SeriesAuthorRef>();
  for (const book of [...series.books].sort(compareByPartThenCreated)) {
    const orderedAuthors = [...book.authors].sort(
      (first, second) => first.position - second.position,
    );
    for (const { author } of orderedAuthors) {
      if (!authorsById.has(author.id)) {
        authorsById.set(author.id, { id: author.id, name: author.name });
      }
    }
  }

  return [...authorsById.values()];
}

function toSeriesBookView(book: SeriesDetailBook, cover: Nullable<MediaView>): SeriesBookView {
  return {
    ageCategory: AgeCategorySchema.parse(book.ageCategory),
    authors: book.authors.map((bookAuthor) => ({
      id: bookAuthor.author.id,
      name: bookAuthor.author.name,
    })),
    cover,
    createdAt: book.createdAt.toISOString(),
    currentPage: book.readingProgress?.currentPage ?? null,
    formats: BookFormatsSchema.parse(book.formats),
    genres: BookGenresSchema.parse(book.genres),
    id: book.id,
    isFavorite: book.isFavorite,
    isInReadingQueue: book.queuePosition !== null,
    originalTitle: book.originalTitle,
    ownershipStatus: OwnershipStatusSchema.parse(book.ownershipStatus),
    pagesCount: book.pagesCount,
    partNumber: book.partNumber,
    publicationYear: book.publicationYear,
    rating: book.readingProgress?.rating ?? null,
    readingStatus: ReadingStatusSchema.parse(book.readingStatus),
    tags: book.tags.map((bookTag) => ({ id: bookTag.tag.id, name: bookTag.tag.name })),
    title: book.title,
  };
}

function toStatsBook(book: SeriesDetailBook) {
  return {
    createdAt: book.createdAt,
    finishedAt: book.readingProgress?.finishedAt ?? null,
    id: book.id,
    isFavorite: book.isFavorite,
    pagesCount: book.pagesCount,
    partNumber: book.partNumber,
    rating: book.readingProgress?.rating ?? null,
    readingStatus: ReadingStatusSchema.parse(book.readingStatus),
    startedAt: book.readingProgress?.startedAt ?? null,
    title: book.title,
  };
}
