import { z } from "zod";

import { BOOK_AUTHORS_MAX, BookAuthorReferenceSchema, BookAuthorRefSchema } from "./authors.js";
import { OwnershipStatusSchema, ReadingStatusSchema } from "./book-enums.js";
import { collapseHorizontalSpaces, collapseSpaces, createPaginatedSchema } from "./common.js";
import { NoHtmlString, queryStringArray } from "./internal.js";
import { TaxonomySearchPaginationQuerySchema } from "./taxonomy.js";

const SERIES_NAME_MIN = 2;
const SERIES_NAME_MAX = 120;
export const SERIES_DESCRIPTION_MAX = 5000;

const SERIES_TOTAL_BOOKS_MIN = 1;
const SERIES_TOTAL_BOOKS_MAX = 999;

export const SeriesStatusSchema = z.enum(["completed", "ongoing", "unknown"]);

export type SeriesStatus = z.infer<typeof SeriesStatusSchema>;

export const SeriesNameSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.min(SERIES_NAME_MIN, "Series name must be at least 2 characters long").max(
      SERIES_NAME_MAX,
      "Series name must be at most 120 characters long",
    ),
  );

const SeriesDescriptionSchema = z
  .string()
  .transform(collapseHorizontalSpaces)
  .pipe(
    NoHtmlString.max(SERIES_DESCRIPTION_MAX, "Description must be at most 5000 characters long"),
  );

const SeriesTotalBooksSchema = z
  .number()
  .int()
  .min(SERIES_TOTAL_BOOKS_MIN, "Total books must be at least 1")
  .max(SERIES_TOTAL_BOOKS_MAX, "Total books must be at most 999");

export const NewSeriesInputSchema = z.object({
  authors: z.array(BookAuthorReferenceSchema).max(BOOK_AUTHORS_MAX).optional(),
  description: SeriesDescriptionSchema.optional(),
  name: SeriesNameSchema,
  status: SeriesStatusSchema.default("unknown"),
  totalBooks: SeriesTotalBooksSchema.optional(),
});

export type NewSeriesInput = z.infer<typeof NewSeriesInputSchema>;

export const UpdateSeriesInputSchema = z.object({
  authors: z.array(BookAuthorReferenceSchema).max(BOOK_AUTHORS_MAX).optional(),
  description: SeriesDescriptionSchema.nullable().optional(),
  name: SeriesNameSchema.optional(),
  status: SeriesStatusSchema.optional(),
  totalBooks: SeriesTotalBooksSchema.nullable().optional(),
});

export type UpdateSeriesInput = z.infer<typeof UpdateSeriesInputSchema>;

export const SeriesSearchQuerySchema = TaxonomySearchPaginationQuerySchema.extend({
  authorIds: queryStringArray(z.uuid()),
});

export type SeriesSearchQuery = z.infer<typeof SeriesSearchQuerySchema>;

export const SeriesNextBookSchema = z.object({
  id: z.string(),
  partNumber: z.number().nullable(),
  title: z.string(),
});

export type SeriesNextBook = z.infer<typeof SeriesNextBookSchema>;

export const SeriesViewSchema = z.object({
  authors: z.array(BookAuthorRefSchema),
  booksInSeries: z.number(),
  createdAt: z.string(),
  description: z.string().nullable(),
  finishedInSeries: z.number(),
  id: z.string(),
  lastActivityAt: z.string(),
  name: z.string(),
  nextBook: SeriesNextBookSchema.nullable(),
  readingInSeries: z.number(),
  status: SeriesStatusSchema,
  totalBooks: z.number().nullable(),
});

export type SeriesView = z.infer<typeof SeriesViewSchema>;

export const SeriesBookViewSchema = z.object({
  authors: z.array(BookAuthorRefSchema),
  createdAt: z.string(),
  currentPage: z.number().nullable(),
  id: z.string(),
  isFavorite: z.boolean(),
  originalTitle: z.string().nullable(),
  ownershipStatus: OwnershipStatusSchema,
  pagesCount: z.number().nullable(),
  partNumber: z.number().nullable(),
  rating: z.number().nullable(),
  readingStatus: ReadingStatusSchema,
  title: z.string(),
});

export type SeriesBookView = z.infer<typeof SeriesBookViewSchema>;

export const SeriesStatsViewSchema = z.object({
  averageRating: z.number().nullable(),
  booksCount: z.number(),
  finishedCount: z.number(),
  pagesCount: z.number().nullable(),
  readingCount: z.number(),
  unreadCount: z.number(),
});

export type SeriesStatsView = z.infer<typeof SeriesStatsViewSchema>;

export const SeriesDetailsViewSchema = SeriesViewSchema.extend({
  books: z.array(SeriesBookViewSchema),
  stats: SeriesStatsViewSchema,
});

export type SeriesDetailsView = z.infer<typeof SeriesDetailsViewSchema>;

export const SeriesOverviewViewSchema = z.object({
  booksInSeries: z.number(),
  fullyReadSeries: z.number(),
  statusCounts: z.object({
    completed: z.number(),
    ongoing: z.number(),
    unknown: z.number(),
  }),
  topUnfinished: z.array(SeriesViewSchema),
  totalSeries: z.number(),
  unfinishedSeries: z.number(),
});

export type SeriesOverviewView = z.infer<typeof SeriesOverviewViewSchema>;

export const PaginatedSeriesSchema = createPaginatedSchema(SeriesViewSchema);
