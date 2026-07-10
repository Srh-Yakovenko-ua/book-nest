import { z } from "zod";

import type { Nullable } from "./common.js";

import { RECENT_USED_LIMIT_DEFAULT, RECENT_USED_LIMIT_MAX } from "./internal.js";
import { CatalogLocaleSchema, TaxonomySearchPaginationQuerySchema } from "./taxonomy.js";

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
