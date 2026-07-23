import { z } from "zod";

import type { Nullable, Paginator } from "./common.js";

import { createPaginatedSchema, noHtmlTags } from "./common.js";
import {
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
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

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

export const LibraryPublisherDetailSchema = z.object({
  countryCode: z.string().nullable(),
  foundedYear: z.number().int().nullable(),
  id: z.string(),
  isCustom: z.boolean(),
  name: z.string(),
  stats: LibraryPublisherStatsSchema,
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

export const LibraryPublishersSummarySchema = z.object({
  averageBookRating: z.number().nullable(),
  booksWithoutPublisherCount: z.number().int(),
  booksWithPublisherCount: z.number().int(),
  expectedPriceTotals: z.array(LibraryPublisherPriceTotalSchema),
  publishersCount: z.number().int(),
  ratedBooksCount: z.number().int(),
  wantToBuyBooksCount: z.number().int(),
});

export type LibraryPublishersSummary = z.infer<typeof LibraryPublishersSummarySchema>;

export const LibraryPublishersGeographySchema = z.enum(["all", "ua", "foreign", "unknown"]);

export type LibraryPublishersGeography = z.infer<typeof LibraryPublishersGeographySchema>;

export const LibraryPublishersSourceSchema = z.enum(["all", "global", "custom"]);

export type LibraryPublishersSource = z.infer<typeof LibraryPublishersSourceSchema>;

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
  geography: LibraryPublishersGeographySchema.default("all"),
  hasBooksToBuy: z.stringbool().optional(),
  hasRatedBooks: z.stringbool().optional(),
  hasSeries: z.stringbool().optional(),
  locale: CatalogLocaleSchema.default("uk"),
  order: LibraryPublishersOrderSchema.default("desc"),
  sort: LibraryPublishersSortSchema.default("booksCount"),
  source: LibraryPublishersSourceSchema.default("all"),
});

export type LibraryPublishersQuery = z.infer<typeof LibraryPublishersQuerySchema>;

export const LibraryPublisherDetailQuerySchema = z.object({
  locale: CatalogLocaleSchema.default("uk"),
});

export type LibraryPublisherDetailQuery = z.infer<typeof LibraryPublisherDetailQuerySchema>;

export const PublisherCountryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(z.string().regex(COUNTRY_CODE_PATTERN, "Country code must be a 2-letter ISO code"));

export const PublisherWebsiteUrlSchema = z
  .string()
  .trim()
  .max(PUBLISHER_WEBSITE_URL_MAX, "URL must be at most 300 characters long")
  .refine(noHtmlTags, "HTML tags are not allowed")
  .pipe(z.url({ error: "Enter a valid link", protocol: HTTP_OR_HTTPS_PROTOCOL }));

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
