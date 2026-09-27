import { z } from "zod";

import type { Nullable, Paginator } from "./common.js";

import { createPaginatedSchema } from "./common.js";
import { IsoCountryCodeSchema } from "./countries.js";
import {
  boundedUrlSchema,
  CountSchema,
  HTTP_OR_HTTPS_PROTOCOL,
  RECENT_USED_LIMIT_DEFAULT,
  RECENT_USED_LIMIT_MAX,
} from "./internal.js";
import {
  CatalogLocaleSchema,
  TaxonomyNameSchema,
  TaxonomySearchPaginationQuerySchema,
} from "./taxonomy.js";

export type PublisherView = {
  countryCode: Nullable<string>;
  foundedYear: Nullable<number>;
  id: string;
  isCustom: boolean;
  logoAttribution: Nullable<string>;
  logoLicense: Nullable<string>;
  logoLicenseUrl: Nullable<string>;
  logoUrl: Nullable<string>;
  name: string;
  websiteUrl: Nullable<string>;
};

export const BookPublisherRefSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const PublisherSearchPaginationQuerySchema = TaxonomySearchPaginationQuerySchema.extend({
  locale: CatalogLocaleSchema.default("uk"),
});

export type PublisherSearchPaginationQuery = z.infer<typeof PublisherSearchPaginationQuerySchema>;

export const RecentPublishersQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(RECENT_USED_LIMIT_MAX)
    .default(RECENT_USED_LIMIT_DEFAULT),
  locale: CatalogLocaleSchema.default("uk"),
});

export type RecentPublishersQuery = z.infer<typeof RecentPublishersQuerySchema>;

const PUBLISHER_WEBSITE_URL_MAX = 300;
const PUBLISHER_FOUNDED_YEAR_MIN = 1400;
const PUBLISHER_FOUNDED_YEAR_MAX = 2100;

export const LibraryPublisherStatsSchema = z.object({
  averageRating: z.number().nullable(),
  booksCount: z.number().int(),
  lastBookAddedAt: z.string().nullable(),
  lastBookReadAt: z.string().nullable(),
  queueCount: z.number().int(),
  ratedBooksCount: z.number().int(),
  readCount: z.number().int(),
  readingCount: z.number().int(),
  seriesCount: z.number().int(),
  wantToBuyCount: z.number().int(),
  wantToReadCount: z.number().int(),
});

export type LibraryPublisherStats = z.infer<typeof LibraryPublisherStatsSchema>;

export const LibraryPublisherListItemSchema = z.object({
  countryCode: z.string().nullable(),
  foundedYear: z.number().int().nullable(),
  id: z.string(),
  isCustom: z.boolean(),
  name: z.string(),
  stats: LibraryPublisherStatsSchema,
  websiteUrl: z.string().nullable(),
});

export type LibraryPublisherListItem = z.infer<typeof LibraryPublisherListItemSchema>;

export const LibraryPublisherDetailStatsSchema = LibraryPublisherStatsSchema.extend({
  wishlistWithoutPriceCount: z.number().int(),
});

export type LibraryPublisherDetailStats = z.infer<typeof LibraryPublisherDetailStatsSchema>;

export const LibraryPublisherDetailSchema = z.object({
  countryCode: z.string().nullable(),
  foundedYear: z.number().int().nullable(),
  id: z.string(),
  isCustom: z.boolean(),
  name: z.string(),
  stats: LibraryPublisherDetailStatsSchema,
  websiteUrl: z.string().nullable(),
});

export type LibraryPublisherDetail = z.infer<typeof LibraryPublisherDetailSchema>;

export const LibraryPublishersPageSchema = createPaginatedSchema(LibraryPublisherListItemSchema);

export type LibraryPublishersPage = Paginator<LibraryPublisherListItem>;

export const LibraryPublisherPriceTotalSchema = z.object({
  amount: z.number(),
  currency: z.string(),
  pricedBooksCount: z.number().int(),
});

export type LibraryPublisherPriceTotal = z.infer<typeof LibraryPublisherPriceTotalSchema>;

export const LIBRARY_PUBLISHERS_INSIGHT_LIMITS = {
  listSize: 3,
} as const;

export const LibraryPublishersMostRepresentedSchema = z.object({
  booksCount: z.number().int(),
  id: z.string(),
  name: z.string(),
});

export type LibraryPublishersMostRepresented = z.infer<
  typeof LibraryPublishersMostRepresentedSchema
>;

export const LibraryPublishersMostReadSchema = z.object({
  id: z.string(),
  name: z.string(),
  readCount: z.number().int(),
});

export type LibraryPublishersMostRead = z.infer<typeof LibraryPublishersMostReadSchema>;

export const LibraryPublishersUnreadSchema = z.object({
  id: z.string(),
  name: z.string(),
  unreadCount: z.number().int(),
});

export type LibraryPublishersUnread = z.infer<typeof LibraryPublishersUnreadSchema>;

export const LibraryPublishersBestRatedSchema = z.object({
  averageRating: z.number(),
  id: z.string(),
  name: z.string(),
  ratedBooksCount: z.number().int(),
});

export type LibraryPublishersBestRated = z.infer<typeof LibraryPublishersBestRatedSchema>;

export const LibraryPublishersSummarySchema = z.object({
  averageBookRating: z.number().nullable(),
  bestRatedPublishers: z
    .array(LibraryPublishersBestRatedSchema)
    .max(LIBRARY_PUBLISHERS_INSIGHT_LIMITS.listSize),
  booksToBuyWithPublisherCount: z.number().int(),
  booksWithoutPublisherCount: z.number().int(),
  booksWithPublisherCount: z.number().int(),
  expectedPriceTotals: z.array(LibraryPublisherPriceTotalSchema),
  mostReadPublisher: LibraryPublishersMostReadSchema.nullable(),
  mostRepresentedPublisher: LibraryPublishersMostRepresentedSchema.nullable(),
  publishersCount: z.number().int(),
  publishersInPlansCount: z.number().int(),
  ratedBooksCount: z.number().int(),
  topFiveBooksCoveragePercent: z.number(),
  unreadPublishers: z
    .array(LibraryPublishersUnreadSchema)
    .max(LIBRARY_PUBLISHERS_INSIGHT_LIMITS.listSize),
  wantToBuyBooksCount: z.number().int(),
});

export type LibraryPublishersSummary = z.infer<typeof LibraryPublishersSummarySchema>;

export const LibraryPublishersGeographySchema = z.enum(["all", "ua", "foreign", "unknown"]);

export type LibraryPublishersGeography = z.infer<typeof LibraryPublishersGeographySchema>;

export const LibraryPublishersSourceSchema = z.enum(["all", "global", "custom"]);

export type LibraryPublishersSource = z.infer<typeof LibraryPublishersSourceSchema>;

export const LibraryPublishersQuickFilterSchema = z.enum([
  "all",
  "reading",
  "read",
  "to_buy",
  "series",
]);

export type LibraryPublishersQuickFilter = z.infer<typeof LibraryPublishersQuickFilterSchema>;

export const LibraryPublishersSortSchema = z.enum([
  "name",
  "booksCount",
  "readCount",
  "wantToBuyCount",
  "averageRating",
  "lastBookAddedAt",
]);

export type LibraryPublishersSort = z.infer<typeof LibraryPublishersSortSchema>;

export const LibraryPublishersOrderSchema = z.enum(["asc", "desc"]);

export type LibraryPublishersOrder = z.infer<typeof LibraryPublishersOrderSchema>;

export const LibraryPublishersQuerySchema = TaxonomySearchPaginationQuerySchema.extend({
  filter: LibraryPublishersQuickFilterSchema.default("all"),
  geography: LibraryPublishersGeographySchema.default("all"),
  hasBooksToBuy: z.stringbool().optional(),
  hasQueue: z.stringbool().optional(),
  hasRatedBooks: z.stringbool().optional(),
  hasSeries: z.stringbool().optional(),
  hasWantToRead: z.stringbool().optional(),
  locale: CatalogLocaleSchema.default("uk"),
  order: LibraryPublishersOrderSchema.default("desc"),
  sort: LibraryPublishersSortSchema.default("booksCount"),
  source: LibraryPublishersSourceSchema.default("all"),
});

export type LibraryPublishersQuery = z.infer<typeof LibraryPublishersQuerySchema>;

export const LibraryPublishersQuickCountsQuerySchema = LibraryPublishersQuerySchema.omit({
  filter: true,
  locale: true,
  order: true,
  pageNumber: true,
  pageSize: true,
  sort: true,
});

export type LibraryPublishersQuickCountsQuery = z.infer<
  typeof LibraryPublishersQuickCountsQuerySchema
>;

export const LibraryPublishersQuickCountsSchema = z.object({
  all: CountSchema,
  read: CountSchema,
  reading: CountSchema,
  series: CountSchema,
  to_buy: CountSchema,
} satisfies Record<LibraryPublishersQuickFilter, typeof CountSchema>);

export type LibraryPublishersQuickCounts = z.infer<typeof LibraryPublishersQuickCountsSchema>;

export const LibraryPublisherDetailQuerySchema = z.object({
  locale: CatalogLocaleSchema.default("uk"),
});

export type LibraryPublisherDetailQuery = z.infer<typeof LibraryPublisherDetailQuerySchema>;

export const LibraryPublishersSummaryQuerySchema = z.object({
  locale: CatalogLocaleSchema.default("uk"),
});

export type LibraryPublishersSummaryQuery = z.infer<typeof LibraryPublishersSummaryQuerySchema>;

export const PublisherCountryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(IsoCountryCodeSchema);

export const PublisherWebsiteUrlSchema = boundedUrlSchema({
  maxLength: PUBLISHER_WEBSITE_URL_MAX,
  protocol: HTTP_OR_HTTPS_PROTOCOL,
  urlError: "Enter a valid link",
});

export const PublisherFoundedYearSchema = z
  .number()
  .int()
  .min(PUBLISHER_FOUNDED_YEAR_MIN)
  .max(PUBLISHER_FOUNDED_YEAR_MAX);

export const UpdatePublisherInputSchema = z.object({
  countryCode: PublisherCountryCodeSchema.nullable().optional(),
  foundedYear: PublisherFoundedYearSchema.nullable().optional(),
  name: TaxonomyNameSchema.optional(),
  websiteUrl: PublisherWebsiteUrlSchema.nullable().optional(),
});

export type UpdatePublisherInput = z.infer<typeof UpdatePublisherInputSchema>;
