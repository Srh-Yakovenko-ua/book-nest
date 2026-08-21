import { z } from "zod";

import {
  AgeCategorySchema,
  BookFormatSchema,
  BookLanguageSchema,
  BookTypeSchema,
  OwnershipStatusSchema,
  QueuePrioritySchema,
  ReadingStatusSchema,
} from "./book-enums.js";
import { BookViewSchema, LIBRARY_SEARCH_MAX } from "./books.js";
import { GenreKeySchema } from "./genres.js";
import { queryStringArray, ratingBound } from "./internal.js";

export const ReadingQueueItemViewSchema = z.object({
  book: BookViewSchema,
  position: z.number().int().positive(),
});

export type ReadingQueueItemView = z.infer<typeof ReadingQueueItemViewSchema>;

export const READING_QUEUE_LIMIT = 500;

export const ReadingQueueViewSchema = z.object({
  count: z.number().int().nonnegative(),
  items: z.array(ReadingQueueItemViewSchema),
  totalCount: z.number().int().nonnegative(),
  totalPagesCount: z.number().int().nonnegative(),
});

export type ReadingQueueView = z.infer<typeof ReadingQueueViewSchema>;

export const ReadingQueueQuerySchema = z
  .object({
    ageCategory: queryStringArray(AgeCategorySchema),
    author: queryStringArray(z.uuid()),
    bookType: BookTypeSchema.optional(),
    format: queryStringArray(BookFormatSchema),
    genre: queryStringArray(GenreKeySchema),
    hasCover: z.stringbool().optional(),
    language: queryStringArray(BookLanguageSchema),
    owner: queryStringArray(OwnershipStatusSchema),
    pagesMax: z.coerce.number().int().nonnegative().optional(),
    pagesMin: z.coerce.number().int().nonnegative().optional(),
    priority: queryStringArray(QueuePrioritySchema),
    publisher: queryStringArray(z.uuid()),
    q: z.string().trim().max(LIBRARY_SEARCH_MAX).optional(),
    ratingMax: ratingBound().optional(),
    ratingMin: ratingBound().optional(),
    status: queryStringArray(ReadingStatusSchema),
    tag: queryStringArray(z.uuid()),
    yearMax: z.coerce.number().int().optional(),
    yearMin: z.coerce.number().int().optional(),
  })
  .superRefine((value, context) => {
    const ranges = [
      { max: value.pagesMax, min: value.pagesMin, name: "pages" },
      { max: value.ratingMax, min: value.ratingMin, name: "rating" },
      { max: value.yearMax, min: value.yearMin, name: "year" },
    ];
    for (const range of ranges) {
      if (range.min === undefined || range.max === undefined || range.min <= range.max) continue;
      context.addIssue({
        code: "custom",
        message: `${range.name}Min must not exceed ${range.name}Max`,
        path: [`${range.name}Min`],
      });
    }
  });

export type ReadingQueueQuery = z.infer<typeof ReadingQueueQuerySchema>;

export const ReadingQueuePlacementSchema = z.enum(["start", "end", "specific"]);

export type ReadingQueuePlacement = z.infer<typeof ReadingQueuePlacementSchema>;

export const AddToReadingQueueInputSchema = z
  .object({
    bookId: z.uuid(),
    placement: ReadingQueuePlacementSchema,
    position: z.number().int().positive().optional(),
  })
  .refine((value) => value.placement !== "specific" || value.position !== undefined, {
    error: "Вкажіть позицію в черзі",
    path: ["position"],
  });

export type AddToReadingQueueInput = z.infer<typeof AddToReadingQueueInputSchema>;

const REORDER_MAX = 1000;

export const ReorderReadingQueueInputSchema = z.object({
  order: z.array(z.uuid()).min(1).max(REORDER_MAX),
});

export type ReorderReadingQueueInput = z.infer<typeof ReorderReadingQueueInputSchema>;

export const StartReadingFromQueueInputSchema = z.object({
  removeFromQueue: z.boolean(),
});

export type StartReadingFromQueueInput = z.infer<typeof StartReadingFromQueueInputSchema>;

export const ReadingQueueUnavailableBreakdownSchema = z.object({
  inTransit: z.number().int().nonnegative(),
  lentToSomeone: z.number().int().nonnegative(),
  none: z.number().int().nonnegative(),
  wantToBuy: z.number().int().nonnegative(),
});

export type ReadingQueueUnavailableBreakdown = z.infer<
  typeof ReadingQueueUnavailableBreakdownSchema
>;

export const ReadingQueueSummaryViewSchema = z.object({
  availableNowCount: z.number().int().nonnegative(),
  blockedBySeriesOrderCount: z.number().int().nonnegative(),
  seriesBooksCount: z.number().int().nonnegative(),
  seriesInQueueCount: z.number().int().nonnegative(),
  standaloneBooksCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  unavailableByOwnership: ReadingQueueUnavailableBreakdownSchema,
  unavailableCount: z.number().int().nonnegative(),
});

export type ReadingQueueSummaryView = z.infer<typeof ReadingQueueSummaryViewSchema>;

export const ReadingQueueVolumeUnavailableReasonSchema = z.enum([
  "empty_queue",
  "insufficient_coverage",
  "insufficient_history",
  "no_volume_data",
  "stale_activity",
  "zero_pace",
]);

export type ReadingQueueVolumeUnavailableReason = z.infer<
  typeof ReadingQueueVolumeUnavailableReasonSchema
>;

export const ReadingQueueVolumeSummaryViewSchema = z.object({
  audiobookOnlyCount: z.number().int().nonnegative(),
  coverage: z.object({
    calculatedBooks: z.number().int().nonnegative(),
    ratio: z.number().min(0).max(1),
    totalBooks: z.number().int().nonnegative(),
  }),
  estimate: z.object({
    daysMax: z.number().int().positive().nullable(),
    daysMin: z.number().int().positive().nullable(),
    daysUntilForecast: z.number().int().nonnegative().nullable(),
    reasonUnavailable: ReadingQueueVolumeUnavailableReasonSchema.nullable(),
  }),
  hasMissingData: z.boolean(),
  pace: z.object({
    activeDaysInPeriod: z.number().int().nonnegative(),
    lastActivityAt: z.iso.date().nullable(),
    pagesPerCalendarDay: z.number().nullable(),
    sourcePeriodDays: z.number().int().nonnegative(),
  }),
  pages: z.object({
    invalidBooks: z.number().int().nonnegative(),
    knownRemaining: z.number().int().nonnegative(),
    missingBooks: z.number().int().nonnegative(),
  }),
  queueBooksCount: z.number().int().nonnegative(),
});

export type ReadingQueueVolumeSummaryView = z.infer<typeof ReadingQueueVolumeSummaryViewSchema>;
