import type { BookView } from "@app/shared";

import {
  AgeCategorySchema,
  BookFormatSchema,
  BookGenreSchema,
  BookLanguageSchema,
  BookTypeSchema,
  CurrencySchema,
  DeliveryStatusSchema,
  OwnershipStatusSchema,
  QueuePrioritySchema,
  ReadingStatusSchema,
  SeriesStatusSchema,
} from "@app/shared";
import { z } from "zod";

const deliveryInfoViewSchema = z.object({
  deliveryStatus: DeliveryStatusSchema.nullable(),
  expectedDeliveryDate: z.string().nullable(),
  note: z.string().nullable(),
  orderDate: z.string().nullable(),
  orderNumber: z.string().nullable(),
  storeName: z.string().nullable(),
});

const loanInfoViewSchema = z.object({
  expectedReturnDate: z.string().nullable(),
  loanDate: z.string().nullable(),
  note: z.string().nullable(),
  personName: z.string(),
});

const purchaseInfoViewSchema = z.object({
  currency: CurrencySchema.nullable(),
  expectedPrice: z.number().nullable(),
  note: z.string().nullable(),
  storeName: z.string().nullable(),
  storeUrl: z.string().nullable(),
});

const readingProgressViewSchema = z.object({
  abandonedAt: z.string().nullable(),
  currentPage: z.number().nullable(),
  finishedAt: z.string().nullable(),
  impression: z.string().nullable(),
  note: z.string().nullable(),
  pausedAt: z.string().nullable(),
  rating: z.number().nullable(),
  startedAt: z.string().nullable(),
});

const seriesViewSchema = z.object({
  description: z.string().nullable(),
  id: z.string(),
  name: z.string(),
  status: SeriesStatusSchema,
  totalBooks: z.number().nullable(),
});

export const bookViewSchema = z.object({
  ageCategory: AgeCategorySchema,
  author: z.object({ id: z.string(), name: z.string() }),
  bookType: BookTypeSchema,
  createdAt: z.string(),
  dedication: z.string().nullable(),
  deliveryInfo: deliveryInfoViewSchema.nullable(),
  description: z.string().nullable(),
  formats: z.array(BookFormatSchema),
  genres: z.array(BookGenreSchema),
  id: z.string(),
  illustrator: z.string().nullable(),
  isbn: z.string().nullable(),
  isFavorite: z.boolean(),
  isInReadingQueue: z.boolean(),
  language: BookLanguageSchema,
  lists: z.array(
    z.object({ description: z.string().nullable(), id: z.string(), name: z.string() }),
  ),
  loanInfo: loanInfoViewSchema.nullable(),
  originalTitle: z.string().nullable(),
  ownershipStatus: OwnershipStatusSchema,
  pagesCount: z.number().nullable(),
  partNumber: z.number().nullable(),
  publicationYear: z.number().nullable(),
  publisher: z.object({ id: z.string(), name: z.string() }).nullable(),
  purchaseInfo: purchaseInfoViewSchema.nullable(),
  queuePriority: QueuePrioritySchema.nullable(),
  readingProgress: readingProgressViewSchema.nullable(),
  readingStatus: ReadingStatusSchema,
  series: seriesViewSchema.nullable(),
  tags: z.array(z.object({ id: z.string(), name: z.string() })),
  title: z.string(),
  translator: z.string().nullable(),
  updatedAt: z.string(),
  userId: z.string(),
}) satisfies z.ZodType<BookView>;
