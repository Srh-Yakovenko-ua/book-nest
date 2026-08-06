import type {
  MediaView,
  Nullable,
  SeriesBookView,
  SeriesCoverPreview,
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

import type { MediaAssetModel } from "../../../generated/prisma/models.js";
import type { SeriesWithDetails } from "../infrastructure/series.repository.js";
import type { SeriesAggregateBookRow } from "./series-aggregates.js";
import type { SeriesBookRow } from "./series-preview.js";

import { toNullableIsoDate } from "../../../core/iso-date.js";
import { toDeliverySummaryView } from "../../delivery/index.js";
import { toLoanInfoView } from "../../loans/index.js";
import { summarizeSeriesAggregates } from "./series-aggregates.js";
import {
  compareByPartThenCreated,
  computeSeriesLastActivityAt,
  summarizeSeriesBooks,
  toSeriesBookPreview,
} from "./series-preview.js";
import { computeSeriesStats } from "./series-stats.js";

type SeriesAuthorRef = { id: string; name: string };

type SeriesDetailBook = SeriesWithDetails["books"][number];

type SeriesViewBookRow = SeriesAggregateBookRow &
  SeriesBookRow & {
    authors: { author: SeriesAuthorRef; position: number }[];
    coverMedia?: Nullable<MediaAssetModel>;
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

const SERIES_COVER_PREVIEW_LIMIT = 3;

export function toSeriesDetailsView({
  covers,
  series,
  today,
}: {
  covers: Map<string, Nullable<MediaView>>;
  series: SeriesWithDetails;
  today: Date;
}): SeriesDetailsView {
  const orderedBooks = [...series.books].sort(compareByPartThenCreated);
  const books = orderedBooks.map((book) =>
    toSeriesBookView({ book, cover: covers.get(book.id) ?? null, today }),
  );

  return {
    ...toSeriesView({ coverByBookId: covers, series }),
    books,
    publishers: collectSeriesPublishers(series.books),
    stats: computeSeriesStats(series.books.map(toStatsBook)),
  };
}

export function toSeriesView({
  coverByBookId = new Map(),
  series,
}: {
  coverByBookId?: Map<string, Nullable<MediaView>>;
  series: SeriesViewSource;
}): SeriesView {
  const books = series.books.map(toSeriesBookPreview);
  const {
    finishedInSeries,
    hasPublicationYears,
    hasPublisher,
    missingPartNumbers,
    nextBook,
    readingInSeries,
  } = summarizeSeriesBooks(books);

  return {
    ...summarizeSeriesAggregates(series.books),
    authors: resolveSeriesAuthors(series),
    booksInSeries: series._count.books,
    covers: buildSeriesCoverPreviews({ books: series.books, coverByBookId }),
    createdAt: series.createdAt.toISOString(),
    description: series.description,
    finishedInSeries,
    genres: series.genres,
    hasPublicationYears,
    hasPublisher,
    id: series.id,
    lastActivityAt: computeSeriesLastActivityAt({
      books,
      seriesUpdatedAt: series.updatedAt,
    }).toISOString(),
    missingPartNumbers: [...missingPartNumbers],
    name: series.name,
    nextBook:
      nextBook === null ? null : { ...nextBook, cover: coverByBookId.get(nextBook.id) ?? null },
    readingInSeries,
    status: SeriesStatusSchema.parse(series.status),
    totalBooks: series.totalBooks,
  };
}

function buildSeriesCoverPreviews({
  books,
  coverByBookId,
}: {
  books: SeriesViewBookRow[];
  coverByBookId: Map<string, Nullable<MediaView>>;
}): SeriesCoverPreview[] {
  return [...books]
    .sort(compareByPartThenCreated)
    .flatMap((book) => {
      const cover = coverByBookId.get(book.id) ?? null;
      return cover === null ? [] : [{ bookId: book.id, cover, title: book.title }];
    })
    .slice(0, SERIES_COVER_PREVIEW_LIMIT);
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

function toSeriesBookView({
  book,
  cover,
  today,
}: {
  book: SeriesDetailBook;
  cover: Nullable<MediaView>;
  today: Date;
}): SeriesBookView {
  return {
    activeDelivery: toDeliverySummaryView(book.deliveries).active,
    ageCategory: AgeCategorySchema.parse(book.ageCategory),
    authors: book.authors.map((bookAuthor) => ({
      id: bookAuthor.author.id,
      name: bookAuthor.author.name,
    })),
    cover,
    createdAt: book.createdAt.toISOString(),
    currentPage: book.readingProgress?.currentPage ?? null,
    finishedAt: toNullableIsoDate(book.readingProgress?.finishedAt ?? null),
    formats: BookFormatsSchema.parse(book.formats),
    genres: BookGenresSchema.parse(book.genres),
    id: book.id,
    isFavorite: book.isFavorite,
    isInReadingQueue: book.queuePosition !== null,
    loanInfo: toLoanInfoView({ loans: book.loans, today }),
    originalTitle: book.originalTitle,
    ownershipStatus: OwnershipStatusSchema.parse(book.ownershipStatus),
    pagesCount: book.pagesCount,
    partNumber: book.partNumber,
    publicationYear: book.publicationYear,
    publisher:
      book.publisher === null ? null : { id: book.publisher.id, name: book.publisher.name },
    rating: book.readingProgress?.rating ?? null,
    readingStatus: ReadingStatusSchema.parse(book.readingStatus),
    startedAt: toNullableIsoDate(book.readingProgress?.startedAt ?? null),
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
