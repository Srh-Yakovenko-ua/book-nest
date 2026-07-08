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
} from "@app/shared";

import type { BookWithRelations } from "../infrastructure/books.repository.js";

import { toNullableIsoDate } from "../../../core/iso-date.js";
import { toBookListView } from "../../lists/index.js";
import {
  computeHasUnreadEarlierParts,
  toSeriesBookPreview,
  toSeriesView,
} from "../../series/index.js";
import { toDeliverySummaryView } from "./delivery.mapper.js";

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
    favoriteAddedAt: book.favoriteAddedAt === null ? null : book.favoriteAddedAt.toISOString(),
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
    loanInfo: toLoanInfoView(book.loans),
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
    series: book.series === null ? null : toSeriesView(book.series),
    tags: book.tags.map((bookTag) => ({ id: bookTag.tag.id, name: bookTag.tag.name })),
    title: book.title,
    translator: book.translator,
    updatedAt: book.updatedAt.toISOString(),
    userId: book.userId,
  };
}

function toLoanInfoView(loans: BookWithRelations["loans"]): LoanInfoView | null {
  const loan = loans[0] ?? null;
  if (loan === null) {
    return null;
  }

  return {
    contact: loan.contact,
    expectedReturnDate: toNullableIsoDate(loan.expectedReturnDate),
    loanDate: toNullableIsoDate(loan.loanDate),
    note: loan.note,
    personName: loan.personName,
    remindToReturn: loan.remindToReturn,
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
