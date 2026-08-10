import {
  AgeCategorySchema,
  BookFormatsSchema,
  BookGenresSchema,
  BookLanguageSchema,
  type BookView,
  CurrencySchema,
  type MediaView,
  type Nullable,
  OwnershipStatusSchema,
  type PurchaseInfoView,
  QueuePriorityReasonSchema,
  QueuePrioritySchema,
  type ReadingProgressView,
  ReadingStatusSchema,
} from "@app/shared";

import type { BookWithRelations } from "../infrastructure/books.repository.js";

import { toNullableIsoDate, toNullableIsoDateTime } from "../../../core/iso-date.js";
import { toDeliverySummaryView } from "../../delivery/index.js";
import { toBookListView } from "../../lists/index.js";
import { toLoanInfoView } from "../../loans/index.js";
import {
  computeHasUnreadEarlierParts,
  toSeriesBookPreview,
  toSeriesView,
} from "../../series/index.js";

export function toBookView({
  book,
  cover,
  today,
}: {
  book: BookWithRelations;
  cover: Nullable<MediaView>;
  today: Date;
}): BookView {
  const series = book.series === null || book.series.deletedAt !== null ? null : book.series;

  return {
    ageCategory: AgeCategorySchema.parse(book.ageCategory),
    authors: book.authors.map((bookAuthor) => ({
      id: bookAuthor.author.id,
      name: bookAuthor.author.name,
    })),
    bookType: series === null ? "solo" : "series_part",
    cover,
    createdAt: book.createdAt.toISOString(),
    dedication: book.dedication,
    delivery: toDeliverySummaryView(book.deliveries),
    description: book.description,
    favoriteAddedAt: toNullableIsoDateTime(book.favoriteAddedAt),
    formats: BookFormatsSchema.parse(book.formats),
    genres: BookGenresSchema.parse(book.genres),
    hasUnreadEarlierSeriesParts:
      series === null
        ? null
        : computeHasUnreadEarlierParts({
            books: series.books.map(toSeriesBookPreview),
            currentPartNumber: book.partNumber,
          }),
    id: book.id,
    illustrator: book.illustrator,
    isbn: book.isbn,
    isFavorite: book.isFavorite,
    isFavoriteDedication: book.isFavoriteDedication,
    isInReadingQueue: book.queuePosition !== null,
    language: BookLanguageSchema.parse(book.language),
    lists: book.lists.map((item) => toBookListView(item.list)),
    loanInfo: toLoanInfoView({ loans: book.loans, today }),
    originalTitle: book.originalTitle,
    ownershipStatus: OwnershipStatusSchema.parse(book.ownershipStatus),
    pagesCount: book.pagesCount,
    pagesCountUnavailable: book.pagesCountUnavailable,
    partNumber: series === null ? null : book.partNumber,
    publicationYear: book.publicationYear,
    publisher:
      book.publisher === null ? null : { id: book.publisher.id, name: book.publisher.name },
    purchaseInfo: toPurchaseInfoView(book.purchaseInfo),
    queuePriority:
      book.queuePriority === null ? null : QueuePrioritySchema.parse(book.queuePriority),
    queuePriorityReason:
      book.queuePriorityReason === null
        ? null
        : QueuePriorityReasonSchema.parse(book.queuePriorityReason),
    queuePriorityReasonCustomText: book.queuePriorityReasonCustomText,
    queuePriorityTargetDate: toNullableIsoDate(book.queuePriorityTargetDate),
    readingProgress: toReadingProgressView(book.readingProgress),
    readingStatus: ReadingStatusSchema.parse(book.readingStatus),
    series: series === null ? null : toSeriesView({ series }),
    tags: book.tags.map((bookTag) => ({ id: bookTag.tag.id, name: bookTag.tag.name })),
    title: book.title,
    translator: book.translator,
    updatedAt: book.updatedAt.toISOString(),
    userId: book.userId,
    wishlistAddedAt: toNullableIsoDateTime(book.wishlistAddedAt),
  };
}

function toPurchaseInfoView(
  purchaseInfo: BookWithRelations["purchaseInfo"],
): Nullable<PurchaseInfoView> {
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
): Nullable<ReadingProgressView> {
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
