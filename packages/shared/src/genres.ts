import { z } from "zod";

import { createPaginatedSchema, paginationQueryFields } from "./common.js";
import {
  CountSchema,
  queryStringArray,
  ratingBound,
  RECENT_USED_LIMIT_DEFAULT,
  RECENT_USED_LIMIT_MAX,
} from "./internal.js";

export const BOOK_GENRES_MAX = 5;
const GENRE_KEY_MAX = 64;
const GENRE_SEARCH_MAX = 100;

export const GENRES_PAGE_SIZE = 24;

export const GENRE_SUMMARY_RULES = {
  highestRatedMinRatedBooks: 3,
  leadersLimit: 2,
} as const;

export const GenreKeySchema = z.string().trim().min(1).max(GENRE_KEY_MAX);

export const GenreGroupKeySchema = z.string().trim().min(1).max(GENRE_KEY_MAX);

export const BookGenresSchema = z
  .array(GenreKeySchema)
  .max(BOOK_GENRES_MAX, "You can select at most 5 genres")
  .refine((genres) => new Set(genres).size === genres.length, "Genres must not contain duplicates");

export type GenreView = {
  groupKey: string;
  groupName: string;
  id: string;
  isDefault: boolean;
  key: string;
  name: string;
};

export const RecentGenresQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(RECENT_USED_LIMIT_MAX)
    .default(RECENT_USED_LIMIT_DEFAULT),
});

export type RecentGenresQuery = z.infer<typeof RecentGenresQuerySchema>;

export const GenreSortSchema = z.enum([
  "books_count_desc",
  "name_asc",
  "read_count_desc",
  "queue_count_desc",
  "rating_desc",
]);

export type GenreSort = z.infer<typeof GenreSortSchema>;

export const GENRE_SORT_DEFAULT = "books_count_desc" satisfies GenreSort;

export const GenreQuickFilterSchema = z.enum([
  "all",
  "unread",
  "in_queue",
  "finished",
  "want_to_buy",
]);

export type GenreQuickFilter = z.infer<typeof GenreQuickFilterSchema>;

export const GENRE_QUICK_FILTER_DEFAULT = "all" satisfies GenreQuickFilter;

const genresDatasetQueryFields = {
  booksMax: z.coerce.number().int().nonnegative().optional(),
  booksMin: z.coerce.number().int().nonnegative().optional(),
  group: queryStringArray(GenreGroupKeySchema),
  q: z.string().trim().max(GENRE_SEARCH_MAX).optional(),
  ratingMax: ratingBound().optional(),
  ratingMin: ratingBound().optional(),
};

type GenresDatasetRanges = {
  booksMax?: number;
  booksMin?: number;
  ratingMax?: number;
  ratingMin?: number;
};

const refineGenresDatasetRanges = (value: GenresDatasetRanges, context: z.RefinementCtx): void => {
  const ranges = [
    { max: value.booksMax, min: value.booksMin, name: "books" },
    { max: value.ratingMax, min: value.ratingMin, name: "rating" },
  ];
  for (const range of ranges) {
    if (range.min === undefined || range.max === undefined || range.min <= range.max) continue;
    context.addIssue({
      code: "custom",
      message: `${range.name}Min must not exceed ${range.name}Max`,
      path: [`${range.name}Min`],
    });
  }
};

export const GenresQuerySchema = z
  .object({
    ...genresDatasetQueryFields,
    filter: GenreQuickFilterSchema.default(GENRE_QUICK_FILTER_DEFAULT),
    ...paginationQueryFields({ pageSizeDefault: GENRES_PAGE_SIZE }),
    sort: GenreSortSchema.default(GENRE_SORT_DEFAULT),
  })
  .superRefine(refineGenresDatasetRanges);

export type GenresQuery = z.infer<typeof GenresQuerySchema>;

export const GenreFacetsQuerySchema = z
  .object(genresDatasetQueryFields)
  .superRefine(refineGenresDatasetRanges);

export type GenreFacetsQuery = z.infer<typeof GenreFacetsQuerySchema>;

export const GenreStatsViewSchema = z.object({
  averageRating: z.number().nullable(),
  booksCount: CountSchema,
  coverUrls: z.array(z.string()),
  groupKey: z.string(),
  groupName: z.string(),
  key: z.string(),
  label: z.string(),
  ratedBooksCount: CountSchema,
  readCount: CountSchema,
  readingQueueCount: CountSchema,
  wantToBuyCount: CountSchema,
});

export type GenreStatsView = z.infer<typeof GenreStatsViewSchema>;

export const PaginatedGenreStatsSchema = createPaginatedSchema(GenreStatsViewSchema);

export type PaginatedGenreStats = z.infer<typeof PaginatedGenreStatsSchema>;

export const GenreQuickCountsSchema = z.object({
  all: CountSchema,
  finished: CountSchema,
  in_queue: CountSchema,
  unread: CountSchema,
  want_to_buy: CountSchema,
});

export type GenreQuickCounts = z.infer<typeof GenreQuickCountsSchema>;

export const GenreGroupFacetSchema = z.object({
  key: z.string(),
  label: z.string(),
});

export type GenreGroupFacet = z.infer<typeof GenreGroupFacetSchema>;

export const GenreFacetsViewSchema = z.object({
  groups: z
    .array(GenreGroupFacetSchema)
    .describe("Stable system groups represented in the unfiltered user Genres dataset."),
  quickCounts: GenreQuickCountsSchema.describe(
    "Quick-filter counts under the committed search and advanced filters.",
  ),
});

export type GenreFacetsView = z.infer<typeof GenreFacetsViewSchema>;

export const GenreSummaryGenreViewSchema = z.object({
  averageRating: z.number().nullable(),
  booksCount: CountSchema,
  key: z.string(),
  label: z.string(),
  ratedBooksCount: CountSchema,
  readCount: CountSchema,
  readingQueueCount: CountSchema,
  wantToBuyCount: CountSchema,
});

export type GenreSummaryGenreView = z.infer<typeof GenreSummaryGenreViewSchema>;

export const GenreSummaryLeaderViewSchema = z.object({
  leaders: z
    .array(GenreSummaryGenreViewSchema)
    .describe("At most two tied leaders in a stable order."),
  leadersCount: z.number().int().positive().describe("Total number of tied leaders."),
});

export type GenreSummaryLeaderView = z.infer<typeof GenreSummaryLeaderViewSchema>;

export const GenreSummaryViewSchema = z.object({
  booksWithGenresCount: CountSchema,
  finishedBooksCount: CountSchema,
  finishedBooksWithGenresCount: CountSchema,
  highestRated: GenreSummaryLeaderViewSchema.nullable(),
  libraryBooksCount: CountSchema,
  mostFrequent: GenreSummaryLeaderViewSchema.nullable(),
  mostQueued: GenreSummaryLeaderViewSchema.nullable(),
  mostRead: GenreSummaryLeaderViewSchema.nullable(),
  mostWantedToBuy: GenreSummaryLeaderViewSchema.nullable(),
  queuedBooksCount: CountSchema,
  queuedBooksWithGenresCount: CountSchema,
  ratedBooksCount: CountSchema,
  ratedBooksWithGenresCount: CountSchema,
  usedGenresCount: CountSchema,
  wantToBuyBooksCount: CountSchema,
  wantToBuyBooksWithGenresCount: CountSchema,
});

export type GenreSummaryView = z.infer<typeof GenreSummaryViewSchema>;

export const DormantGenreViewSchema = z.object({
  booksCount: CountSchema,
  key: z.string(),
  label: z.string(),
  lastReadingActivityAt: z.iso.datetime(),
  readCount: CountSchema,
});

export type DormantGenreView = z.infer<typeof DormantGenreViewSchema>;

export const NewForYouGenreViewSchema = z.object({
  booksCount: CountSchema,
  firstAddedAt: z.iso.datetime(),
  key: z.string(),
  label: z.string(),
});

export type NewForYouGenreView = z.infer<typeof NewForYouGenreViewSchema>;

export const UnratedFinishedGenreViewSchema = z.object({
  key: z.string(),
  label: z.string(),
  latestUnratedFinishedAt: z.iso.datetime().nullable(),
  unratedFinishedCount: CountSchema,
});

export type UnratedFinishedGenreView = z.infer<typeof UnratedFinishedGenreViewSchema>;

export const GenresOverviewViewSchema = z.object({
  dormantGenres: z.array(DormantGenreViewSchema),
  newForYouGenres: z.array(NewForYouGenreViewSchema),
  unratedFinishedGenres: z.array(UnratedFinishedGenreViewSchema),
});

export type GenresOverviewView = z.infer<typeof GenresOverviewViewSchema>;
