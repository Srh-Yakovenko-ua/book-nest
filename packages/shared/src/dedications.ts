import { z } from "zod";

import { LIBRARY_SEARCH_MAX } from "./books.js";
import { paginationQueryFields } from "./common.js";
import { GenreKeySchema } from "./genres.js";
import { CountSchema } from "./internal.js";

export const DEDICATIONS_PAGE_SIZE_DEFAULT = 12;

export const DedicationFilterSchema = z.enum([
  "all",
  "favorites",
  "without_favorites",
  "finished",
  "unfinished",
]);

export type DedicationFilter = z.infer<typeof DedicationFilterSchema>;

export const DedicationSortSchema = z.enum([
  "newest",
  "recently_updated",
  "book_title_asc",
  "author_asc",
  "favorites_first",
  "publication_year_desc",
]);

export type DedicationSort = z.infer<typeof DedicationSortSchema>;

export const DedicationsQuerySchema = z.object({
  filter: DedicationFilterSchema.default("all"),
  genre: GenreKeySchema.optional(),
  ...paginationQueryFields({ pageSizeDefault: DEDICATIONS_PAGE_SIZE_DEFAULT }),
  q: z.string().max(LIBRARY_SEARCH_MAX).optional(),
  sort: DedicationSortSchema.default("newest"),
});

export type DedicationsQuery = z.infer<typeof DedicationsQuerySchema>;

export const DedicationsQuickCountsQuerySchema = DedicationsQuerySchema.omit({
  filter: true,
  pageNumber: true,
  pageSize: true,
  sort: true,
});

export type DedicationsQuickCountsQuery = z.infer<typeof DedicationsQuickCountsQuerySchema>;

export const DedicationsQuickCountsSchema = z.object({
  all: CountSchema,
  favorites: CountSchema,
  finished: CountSchema,
  unfinished: CountSchema,
});

export type DedicationsQuickCounts = z.infer<typeof DedicationsQuickCountsSchema>;

export const DedicationQuickFilterKeySchema = DedicationsQuickCountsSchema.keyof();

export type DedicationQuickFilterKey = z.infer<typeof DedicationQuickFilterKeySchema>;

export const DedicationsSummaryViewSchema = z.object({
  authorsCount: z.number().optional(),
  availableGenres: z.array(GenreKeySchema),
  favoriteCount: z.number(),
  finishedCount: z.number(),
  topAuthor: z
    .object({
      count: z.number(),
      name: z.string(),
    })
    .nullable(),
  topGenre: z
    .object({
      count: z.number(),
      genre: z.string(),
    })
    .nullable(),
  totalCount: z.number(),
  unfinishedCount: z.number(),
});

export type DedicationsSummaryView = z.infer<typeof DedicationsSummaryViewSchema>;
