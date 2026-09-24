import { z } from "zod";

import { BookAuthorRefSchema } from "./authors.js";
import { BookFormatSchema, OwnershipStatusSchema, ReadingStatusSchema } from "./book-enums.js";
import { BestOfferViewSchema } from "./book-store-links.js";
import { MediaViewSchema } from "./media.js";
import { SeriesStatusSchema } from "./series.js";

export const PUBLISHER_OVERVIEW_LIMITS = {
  activeReading: 3,
  series: 3,
  wishlist: 3,
} as const;

const PublisherOverviewBookBaseSchema = z.object({
  authors: z.array(BookAuthorRefSchema),
  cover: MediaViewSchema.nullable(),
  id: z.string(),
  title: z.string(),
});

export const PublisherOverviewLatestBookSeriesSchema = z.object({
  id: z.string(),
  name: z.string(),
  partNumber: z.number().int().nullable(),
  totalBooks: z.number().int().nullable(),
});

export type PublisherOverviewLatestBookSeries = z.infer<
  typeof PublisherOverviewLatestBookSeriesSchema
>;

export const PublisherOverviewLatestBookSchema = PublisherOverviewBookBaseSchema.extend({
  createdAt: z.string(),
  formats: z.array(BookFormatSchema),
  ownershipStatus: OwnershipStatusSchema,
  readingStatus: ReadingStatusSchema,
  series: PublisherOverviewLatestBookSeriesSchema.nullable(),
});

export type PublisherOverviewLatestBook = z.infer<typeof PublisherOverviewLatestBookSchema>;

export const PublisherOverviewReadingProgressSchema = z.object({
  currentPage: z.number().int(),
  pagesCount: z.number().int().positive(),
});

export type PublisherOverviewReadingProgress = z.infer<
  typeof PublisherOverviewReadingProgressSchema
>;

export const PublisherOverviewReadingBookSchema = PublisherOverviewBookBaseSchema.extend({
  progress: PublisherOverviewReadingProgressSchema.nullable(),
  readingStatus: ReadingStatusSchema,
});

export type PublisherOverviewReadingBook = z.infer<typeof PublisherOverviewReadingBookSchema>;

export const PublisherOverviewWishlistBookSchema = PublisherOverviewBookBaseSchema.extend({
  bestOffer: BestOfferViewSchema.nullable(),
});

export type PublisherOverviewWishlistBook = z.infer<typeof PublisherOverviewWishlistBookSchema>;

export const PublisherOverviewSeriesSchema = z.object({
  booksCount: z.number().int(),
  id: z.string(),
  name: z.string(),
  readCount: z.number().int(),
  status: SeriesStatusSchema,
});

export type PublisherOverviewSeries = z.infer<typeof PublisherOverviewSeriesSchema>;

export const LibraryPublisherOverviewSchema = z.object({
  activeReading: z
    .array(PublisherOverviewReadingBookSchema)
    .max(PUBLISHER_OVERVIEW_LIMITS.activeReading),
  latestBook: PublisherOverviewLatestBookSchema.nullable(),
  series: z.array(PublisherOverviewSeriesSchema).max(PUBLISHER_OVERVIEW_LIMITS.series),
  wishlist: z.array(PublisherOverviewWishlistBookSchema).max(PUBLISHER_OVERVIEW_LIMITS.wishlist),
});

export type LibraryPublisherOverview = z.infer<typeof LibraryPublisherOverviewSchema>;
