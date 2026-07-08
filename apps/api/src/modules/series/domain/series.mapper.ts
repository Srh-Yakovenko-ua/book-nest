import type { SeriesBookView, SeriesDetailsView, SeriesView } from "@app/shared";

import { OwnershipStatusSchema, ReadingStatusSchema, SeriesStatusSchema } from "@app/shared";

import type { SeriesWithDetails } from "../infrastructure/series.repository.js";
import type { SeriesBookRow } from "./series-preview.js";

import {
  compareByPartThenCreated,
  computeSeriesLastActivityAt,
  summarizeSeriesBooks,
  toSeriesBookPreview,
} from "./series-preview.js";
import { computeSeriesStats } from "./series-stats.js";

type SeriesDetailBook = SeriesWithDetails["books"][number];

type SeriesViewSource = {
  _count: { books: number };
  authors: { author: { id: string; name: string } }[];
  books: SeriesBookRow[];
  createdAt: Date;
  description: null | string;
  genres: string[];
  id: string;
  name: string;
  status: string;
  totalBooks: null | number;
  updatedAt: Date;
};

export function toSeriesDetailsView(series: SeriesWithDetails): SeriesDetailsView {
  const orderedBooks = [...series.books].sort(compareByPartThenCreated);
  const books = orderedBooks.map(toSeriesBookView);

  return {
    ...toSeriesView(series),
    books,
    stats: computeSeriesStats(books),
  };
}

export function toSeriesView(series: SeriesViewSource): SeriesView {
  const books = series.books.map(toSeriesBookPreview);
  const { finishedInSeries, nextBook, readingInSeries } = summarizeSeriesBooks(books);

  return {
    authors: series.authors.map((seriesAuthor) => ({
      id: seriesAuthor.author.id,
      name: seriesAuthor.author.name,
    })),
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

function toSeriesBookView(book: SeriesDetailBook): SeriesBookView {
  return {
    authors: book.authors.map((bookAuthor) => ({
      id: bookAuthor.author.id,
      name: bookAuthor.author.name,
    })),
    createdAt: book.createdAt.toISOString(),
    currentPage: book.readingProgress?.currentPage ?? null,
    id: book.id,
    isFavorite: book.isFavorite,
    originalTitle: book.originalTitle,
    ownershipStatus: OwnershipStatusSchema.parse(book.ownershipStatus),
    pagesCount: book.pagesCount,
    partNumber: book.partNumber,
    rating: book.readingProgress?.rating ?? null,
    readingStatus: ReadingStatusSchema.parse(book.readingStatus),
    title: book.title,
  };
}
