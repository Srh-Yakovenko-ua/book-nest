import { z } from "zod";

import { LIBRARY_SEARCH_MAX } from "./books.js";
import { LIST_PAGE_SIZE_MAX } from "./common.js";
import { GenreKeySchema } from "./genres.js";

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
  pageNumber: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(LIST_PAGE_SIZE_MAX)
    .default(DEDICATIONS_PAGE_SIZE_DEFAULT),
  q: z.string().max(LIBRARY_SEARCH_MAX).optional(),
  sort: DedicationSortSchema.default("newest"),
});

export type DedicationsQuery = z.infer<typeof DedicationsQuerySchema>;

export const DedicationsSummaryViewSchema = z.object({
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
