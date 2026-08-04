import { z } from "zod";

import { BOOK_AUTHORS_MAX, BookAuthorReferenceSchema, BookAuthorRefSchema } from "./authors.js";
import {
  AgeCategorySchema,
  BookFormatSchema,
  BookLanguageSchema,
  BookPartNumberSchema,
  OwnershipStatusSchema,
  QueuePrioritySchema,
  ReadingStatusSchema,
} from "./book-enums.js";
import {
  collapseHorizontalSpaces,
  collapseSpaces,
  createPaginatedSchema,
  paginationQueryFields,
} from "./common.js";
import { DeliveryViewSchema } from "./delivery-view.js";
import { BookGenresSchema } from "./genres.js";
import { NoHtmlString, queryStringArray } from "./internal.js";
import { LoanInfoViewSchema } from "./loans.js";
import { MediaViewSchema } from "./media.js";
import { BookPublisherRefSchema } from "./publishers.js";
import { TagViewSchema } from "./tags.js";
import { TaxonomySearchPaginationQuerySchema } from "./taxonomy.js";
import { TRASH_PAGE_SIZE_DEFAULT, TrashDeletionResultSchema } from "./trash.js";

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
  genres: BookGenresSchema.default([]),
  name: SeriesNameSchema,
  status: SeriesStatusSchema.default("unknown"),
  totalBooks: SeriesTotalBooksSchema.optional(),
});

export type NewSeriesInput = z.infer<typeof NewSeriesInputSchema>;

export const UpdateSeriesInputSchema = z.object({
  authors: z.array(BookAuthorReferenceSchema).max(BOOK_AUTHORS_MAX).optional(),
  description: SeriesDescriptionSchema.nullable().optional(),
  genres: BookGenresSchema.optional(),
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
  ownershipStatus: OwnershipStatusSchema.nullish(),
  partNumber: z.number().nullable(),
  title: z.string(),
});

export type SeriesNextBook = z.infer<typeof SeriesNextBookSchema>;

export const SeriesCoverPreviewSchema = z.object({
  bookId: z.string(),
  cover: MediaViewSchema,
  title: z.string(),
});

export type SeriesCoverPreview = z.infer<typeof SeriesCoverPreviewSchema>;

export const SeriesOwnershipSchema = z.object({
  ownedCount: z.number().int(),
  total: z.number().int(),
});

export type SeriesOwnership = z.infer<typeof SeriesOwnershipSchema>;

export const SeriesViewSchema = z.object({
  ageCategories: z.array(AgeCategorySchema).default([]),
  authors: z.array(BookAuthorRefSchema),
  averagePages: z.number().nullable(),
  averageRating: z.number().nullable(),
  booksInSeries: z.number(),
  covers: z.array(SeriesCoverPreviewSchema),
  createdAt: z.string(),
  description: z.string().nullable(),
  finishedInSeries: z.number(),
  formats: z.array(BookFormatSchema).default([]),
  genres: z.array(z.string()),
  hasFavoriteBook: z.boolean().default(false),
  hasPublicationYears: z.boolean().default(false),
  hasPublisher: z.boolean().default(false),
  id: z.string(),
  languages: z.array(BookLanguageSchema).default([]),
  lastActivityAt: z.string(),
  missingPartNumbers: z.array(BookPartNumberSchema).default([]),
  name: z.string(),
  nextBook: SeriesNextBookSchema.nullable(),
  ownership: SeriesOwnershipSchema,
  pagesCount: z.number().nullable(),
  readingInSeries: z.number(),
  status: SeriesStatusSchema,
  tags: z.array(TagViewSchema).default([]),
  totalBooks: z.number().nullable(),
});

export type SeriesView = z.infer<typeof SeriesViewSchema>;

export const SeriesBookViewSchema = z.object({
  activeDelivery: DeliveryViewSchema.nullable(),
  ageCategory: AgeCategorySchema,
  authors: z.array(BookAuthorRefSchema),
  cover: MediaViewSchema.nullable().optional(),
  createdAt: z.string(),
  currentPage: z.number().nullable(),
  finishedAt: z.string().nullable(),
  formats: z.array(BookFormatSchema),
  genres: z.array(z.string()),
  id: z.string(),
  isFavorite: z.boolean(),
  isInReadingQueue: z.boolean(),
  loanInfo: LoanInfoViewSchema.nullable(),
  originalTitle: z.string().nullable(),
  ownershipStatus: OwnershipStatusSchema,
  pagesCount: z.number().nullable(),
  partNumber: z.number().nullable(),
  publicationYear: z.number().nullable(),
  publisher: BookPublisherRefSchema.nullable(),
  rating: z.number().nullable(),
  readingStatus: ReadingStatusSchema,
  startedAt: z.string().nullable(),
  tags: z.array(TagViewSchema),
  title: z.string(),
});

export type SeriesBookView = z.infer<typeof SeriesBookViewSchema>;

export const SeriesStatsViewSchema = z.object({
  averagePages: z.number().nullable(),
  averageRating: z.number().nullable(),
  booksCount: z.number(),
  favoriteBook: z.object({ id: z.string(), title: z.string() }).nullable(),
  finishedCount: z.number(),
  lastFinishedAt: z.string().nullable(),
  pagesCount: z.number().nullable(),
  readingCount: z.number(),
  readingDurationDays: z.number().nullable(),
  readPagesCount: z.number().nullable(),
  readPagesPartial: z.boolean(),
  startedAt: z.string().nullable(),
  unreadCount: z.number(),
});

export type SeriesStatsView = z.infer<typeof SeriesStatsViewSchema>;

export const SeriesDetailsViewSchema = SeriesViewSchema.extend({
  books: z.array(SeriesBookViewSchema),
  publishers: z.array(BookPublisherRefSchema),
  stats: SeriesStatsViewSchema,
});

export type SeriesDetailsView = z.infer<typeof SeriesDetailsViewSchema>;

export const SeriesOverviewViewSchema = z.object({
  booksInSeries: z.number(),
  booksLeftInUnfinishedSeries: z.number().optional(),
  finishedBooksInSeries: z.number().optional(),
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

const FAVORITE_CONTINUATIONS_LIMIT_MIN = 1;
const FAVORITE_CONTINUATIONS_LIMIT_MAX = 50;
const FAVORITE_CONTINUATIONS_LIMIT_DEFAULT = 3;

export const FavoriteSeriesContinuationsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(FAVORITE_CONTINUATIONS_LIMIT_MIN)
    .max(FAVORITE_CONTINUATIONS_LIMIT_MAX)
    .default(FAVORITE_CONTINUATIONS_LIMIT_DEFAULT),
});

export type FavoriteSeriesContinuationsQuery = z.infer<
  typeof FavoriteSeriesContinuationsQuerySchema
>;

export const SeriesContinuationRankReasonSchema = z.enum([
  "reading",
  "paused",
  "available",
  "lent",
  "in_transit",
  "want_to_buy",
  "not_owned",
]);

export type SeriesContinuationRankReason = z.infer<typeof SeriesContinuationRankReasonSchema>;

export const SeriesContinuationNextBookSchema = z.object({
  authors: BookAuthorRefSchema.array(),
  cover: MediaViewSchema.nullable(),
  favoriteAddedAt: z.string().nullable(),
  id: z.string(),
  isFavorite: z.boolean(),
  ownershipStatus: OwnershipStatusSchema,
  queue: z
    .object({
      position: z.number().int(),
      priority: QueuePrioritySchema.nullable(),
    })
    .nullable(),
  readingProgress: z
    .object({
      currentPage: z.number().int(),
      percentage: z.number().int().nullable(),
      totalPages: z.number().int().nullable(),
    })
    .nullable(),
  readingStatus: ReadingStatusSchema,
  seriesPosition: z.number().int().nullable(),
  title: z.string(),
});

export type SeriesContinuationNextBook = z.infer<typeof SeriesContinuationNextBookSchema>;

export const FavoriteSeriesContinuationItemSchema = z.object({
  favoriteBooksCount: z.number().int(),
  lastFavoriteAddedAt: z.string().nullable(),
  nextBook: SeriesContinuationNextBookSchema,
  progress: z.object({
    closedBooks: z.number().int(),
    finishedBooks: z.number().int(),
    totalBooks: z.number().int(),
  }),
  rankReason: SeriesContinuationRankReasonSchema,
  series: z.object({
    id: z.string(),
    status: SeriesStatusSchema,
    title: z.string(),
    totalBooks: z.number().int(),
  }),
});

export type FavoriteSeriesContinuationItem = z.infer<typeof FavoriteSeriesContinuationItemSchema>;

export const FavoriteSeriesContinuationsViewSchema = z.object({
  items: FavoriteSeriesContinuationItemSchema.array(),
  nextCursor: z.string().nullable(),
  total: z.number().int(),
});

export type FavoriteSeriesContinuationsView = z.infer<typeof FavoriteSeriesContinuationsViewSchema>;

export const SeriesDeletionResultSchema = TrashDeletionResultSchema.extend({
  seriesId: z.string(),
});

export type SeriesDeletionResult = z.infer<typeof SeriesDeletionResultSchema>;

export const TrashedSeriesViewSchema = z.object({
  booksCount: z.number().int(),
  deletedAt: z.iso.datetime(),
  id: z.string(),
  name: z.string(),
  purgeAt: z.iso.datetime(),
});

export type TrashedSeriesView = z.infer<typeof TrashedSeriesViewSchema>;

export const TrashedSeriesQuerySchema = z.object({
  ...paginationQueryFields({ pageSizeDefault: TRASH_PAGE_SIZE_DEFAULT }),
});

export type TrashedSeriesQuery = z.infer<typeof TrashedSeriesQuerySchema>;

export const PaginatedTrashedSeriesSchema = createPaginatedSchema(TrashedSeriesViewSchema);

export type PaginatedTrashedSeries = z.infer<typeof PaginatedTrashedSeriesSchema>;
