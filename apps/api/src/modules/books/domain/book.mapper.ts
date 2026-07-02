import {
  AgeCategorySchema,
  BookFormatsSchema,
  BookGenresSchema,
  BookLanguageSchema,
  type BookView,
  CurrencySchema,
  type LoanInfoView,
  type MediaView,
  OwnershipStatusSchema,
  type PurchaseInfoView,
  QueuePrioritySchema,
  type ReadingProgressView,
  ReadingStatusSchema,
  SeriesStatusSchema,
  type SeriesView,
} from "@app/shared";

import type { BookWithRelations } from "../infrastructure/books.repository.js";

import { toIsoDate } from "../../../core/iso-date.js";
import { toBookListView } from "../../lists/domain/book-list.mapper.js";
import {
  computeHasUnreadEarlierParts,
  summarizeSeriesBooks,
  toSeriesBookPreview,
} from "../../series/domain/series-preview.js";
import { toDeliverySummaryView } from "./delivery.mapper.js";

const toNullableIsoDate = (value: Date | null): null | string =>
  value === null ? null : toIsoDate(value);

export function toBookView(book: BookWithRelations, cover: MediaView | null): BookView {
  return {
    ageCategory: AgeCategorySchema.parse(book.ageCategory),
    authors: book.authors.map((bookAuthor) => ({
      id: bookAuthor.author.id,
      name: bookAuthor.author.name,
    })),
    bookType: book.series === null ? "solo" : "series_part",
    cover,
    createdAt: book.createdAt.toISOString(),
    dedication: book.dedication,
    delivery: toDeliverySummaryView(book.deliveries),
    description: book.description,
    formats: BookFormatsSchema.parse(book.formats),
    genres: BookGenresSchema.parse(book.genres),
    hasUnreadEarlierSeriesParts:
      book.series === null
        ? null
        : computeHasUnreadEarlierParts({
            books: book.series.books.map(toSeriesBookPreview),
            currentPartNumber: book.partNumber,
          }),
    id: book.id,
    illustrator: book.illustrator,
    isbn: book.isbn,
    isFavorite: book.isFavorite,
    isInReadingQueue: book.queuePosition !== null,
    language: BookLanguageSchema.parse(book.language),
    lists: book.lists.map((item) => toBookListView(item.list)),
    loanInfo: toLoanInfoView(book.loanInfo),
    originalTitle: book.originalTitle,
    ownershipStatus: OwnershipStatusSchema.parse(book.ownershipStatus),
    pagesCount: book.pagesCount,
    partNumber: book.partNumber,
    publicationYear: book.publicationYear,
    publisher:
      book.publisher === null ? null : { id: book.publisher.id, name: book.publisher.name },
    purchaseInfo: toPurchaseInfoView(book.purchaseInfo),
    queuePriority:
      book.queuePriority === null ? null : QueuePrioritySchema.parse(book.queuePriority),
    readingProgress: toReadingProgressView(book.readingProgress),
    readingStatus: ReadingStatusSchema.parse(book.readingStatus),
    series: toSeriesView(book.series),
    tags: book.tags.map((bookTag) => ({ id: bookTag.tag.id, name: bookTag.tag.name })),
    title: book.title,
    translator: book.translator,
    updatedAt: book.updatedAt.toISOString(),
    userId: book.userId,
  };
}

function toLoanInfoView(loanInfo: BookWithRelations["loanInfo"]): LoanInfoView | null {
  if (loanInfo === null) {
    return null;
  }

  return {
    contact: loanInfo.contact,
    expectedReturnDate: toNullableIsoDate(loanInfo.expectedReturnDate),
    loanDate: toNullableIsoDate(loanInfo.loanDate),
    note: loanInfo.note,
    personName: loanInfo.personName,
    remindToReturn: loanInfo.remindToReturn,
  };
}

function toPurchaseInfoView(
  purchaseInfo: BookWithRelations["purchaseInfo"],
): null | PurchaseInfoView {
  if (purchaseInfo === null) {
    return null;
  }

  return {
    currency: purchaseInfo.currency === null ? null : CurrencySchema.parse(purchaseInfo.currency),
    expectedPrice:
      purchaseInfo.expectedPrice === null ? null : purchaseInfo.expectedPrice.toNumber(),
    note: purchaseInfo.note,
    purchasedAt: toNullableIsoDate(purchaseInfo.purchasedAt),
    storeName: purchaseInfo.storeName,
    storeUrl: purchaseInfo.storeUrl,
  };
}

function toReadingProgressView(
  readingProgress: BookWithRelations["readingProgress"],
): null | ReadingProgressView {
  if (readingProgress === null) {
    return null;
  }

  return {
    abandonedAt: toNullableIsoDate(readingProgress.abandonedAt),
    currentPage: readingProgress.currentPage,
    finishedAt: toNullableIsoDate(readingProgress.finishedAt),
    impression: readingProgress.impression,
    lastProgressUpdateAt: toNullableIsoDate(readingProgress.lastProgressUpdateAt),
    note: readingProgress.note,
    pausedAt: toNullableIsoDate(readingProgress.pausedAt),
    rating: readingProgress.rating,
    startedAt: toNullableIsoDate(readingProgress.startedAt),
  };
}

function toSeriesView(series: BookWithRelations["series"]): null | SeriesView {
  if (series === null) {
    return null;
  }

  const { finishedInSeries, nextBook } = summarizeSeriesBooks(
    series.books.map(toSeriesBookPreview),
  );

  return {
    authors: series.authors.map((seriesAuthor) => ({
      id: seriesAuthor.author.id,
      name: seriesAuthor.author.name,
    })),
    booksInSeries: series._count.books,
    description: series.description,
    finishedInSeries,
    id: series.id,
    name: series.name,
    nextBook,
    status: SeriesStatusSchema.parse(series.status),
    totalBooks: series.totalBooks,
  };
}
