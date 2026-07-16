import { z } from "zod";

import { OwnershipStatusSchema, ReadingStatusSchema } from "./book-enums.js";
import { MediaViewSchema } from "./media.js";

export const SeriesOrderProblemTypeSchema = z.enum([
  "missing_previous_from_queue",
  "previous_book_after_later_book",
  "multiple_previous_missing",
  "previous_book_paused",
  "current_reading_ahead_of_order",
  "previous_book_want_to_buy",
  "previous_book_not_owned",
  "previous_book_in_transit",
  "previous_book_lent_out",
  "multiple_books_out_of_order",
]);
export type SeriesOrderProblemType = z.infer<typeof SeriesOrderProblemTypeSchema>;

export const SeriesOrderSeveritySchema = z.enum(["error", "warning", "info"]);
export type SeriesOrderSeverity = z.infer<typeof SeriesOrderSeveritySchema>;

export const SeriesOrderActionCodeSchema = z.enum([
  "ADD_NEXT_PREVIOUS_BEFORE",
  "ADD_ALL_PREVIOUS_BEFORE",
  "REORDER_SERIES_SLOTS",
  "OPEN_PREVIOUS_BOOK",
  "RESUME_PREVIOUS_BOOK",
  "ADD_PREVIOUS_TO_WISHLIST",
  "OPEN_PURCHASE",
  "OPEN_ORDER",
  "OPEN_LOAN",
  "IGNORE_ISSUE",
  "DISABLE_SERIES_CHECK",
]);
export type SeriesOrderActionCode = z.infer<typeof SeriesOrderActionCodeSchema>;

export const SeriesOrderFixStrategySchema = z.enum([
  "ADD_NEXT_PREVIOUS_BEFORE",
  "ADD_ALL_PREVIOUS_BEFORE",
  "REORDER_SERIES_SLOTS",
]);
export type SeriesOrderFixStrategy = z.infer<typeof SeriesOrderFixStrategySchema>;

export const SeriesOrderBookViewSchema = z.object({
  cover: MediaViewSchema.nullable(),
  id: z.string(),
  isCurrentReading: z.boolean(),
  ownershipStatus: OwnershipStatusSchema,
  queuePosition: z.number().int().nullable(),
  readingStatus: ReadingStatusSchema,
  seriesPosition: z.number().int().nullable(),
  title: z.string(),
});
export type SeriesOrderBookView = z.infer<typeof SeriesOrderBookViewSchema>;

export const SeriesOrderPositionViewSchema = z.object({
  bookId: z.string(),
  queuePosition: z.number().int().nullable(),
  seriesPosition: z.number().int().nullable(),
  title: z.string(),
});
export type SeriesOrderPositionView = z.infer<typeof SeriesOrderPositionViewSchema>;

export const SeriesOrderRelatedProblemSchema = z.object({
  affectedBookId: z.string(),
  previousBookId: z.string().nullable(),
  problemType: SeriesOrderProblemTypeSchema,
});
export type SeriesOrderRelatedProblem = z.infer<typeof SeriesOrderRelatedProblemSchema>;

export const SeriesOrderIssueViewSchema = z.object({
  affectedBook: SeriesOrderBookViewSchema,
  allowedActions: z.array(SeriesOrderActionCodeSchema),
  currentOrder: z.array(SeriesOrderPositionViewSchema),
  fingerprint: z.string(),
  previousBook: SeriesOrderBookViewSchema.nullable(),
  problemType: SeriesOrderProblemTypeSchema,
  recommendedOrder: z.array(SeriesOrderPositionViewSchema),
  relatedProblems: z.array(SeriesOrderRelatedProblemSchema),
  series: z.object({ id: z.string(), title: z.string() }),
  severity: SeriesOrderSeveritySchema,
  unresolvedPreviousCount: z.number().int().nonnegative(),
});
export type SeriesOrderIssueView = z.infer<typeof SeriesOrderIssueViewSchema>;

export const SeriesOrderIssuesViewSchema = z.object({
  items: z.array(SeriesOrderIssueViewSchema),
  queueVersion: z.string(),
  total: z.number().int().nonnegative(),
});
export type SeriesOrderIssuesView = z.infer<typeof SeriesOrderIssuesViewSchema>;

export const SeriesOrderQueuePreviewItemSchema = z.object({
  belongsToAffectedSeries: z.boolean(),
  bookId: z.string(),
  queuePosition: z.number().int(),
  title: z.string(),
});
export type SeriesOrderQueuePreviewItem = z.infer<typeof SeriesOrderQueuePreviewItemSchema>;

export const SeriesOrderFixChangeSchema = z.object({
  bookId: z.string(),
  fromPosition: z.number().int().nullable(),
  title: z.string(),
  toPosition: z.number().int(),
  type: z.enum(["add", "move"]),
});
export type SeriesOrderFixChange = z.infer<typeof SeriesOrderFixChangeSchema>;

export const SeriesOrderFixPreviewViewSchema = z.object({
  addedBooksCount: z.number().int().nonnegative(),
  after: z.array(SeriesOrderQueuePreviewItemSchema),
  before: z.array(SeriesOrderQueuePreviewItemSchema),
  changes: z.array(SeriesOrderFixChangeSchema),
  fingerprint: z.string(),
  movedBooksCount: z.number().int().nonnegative(),
  queueVersion: z.string(),
  series: z.object({ id: z.string(), title: z.string() }),
  shiftedUnrelatedBooksCount: z.number().int().nonnegative(),
  strategy: SeriesOrderFixStrategySchema,
  warnings: z.array(z.string()),
});
export type SeriesOrderFixPreviewView = z.infer<typeof SeriesOrderFixPreviewViewSchema>;

export const ApplySeriesOrderFixResponseSchema = z.object({
  addedBookIds: z.array(z.string()),
  changedBookIds: z.array(z.string()),
  queueVersion: z.string(),
  resolvedFingerprint: z.string(),
  success: z.literal(true),
});
export type ApplySeriesOrderFixResponse = z.infer<typeof ApplySeriesOrderFixResponseSchema>;

export const SERIES_ORDER_ISSUES_LIMIT_DEFAULT = 3;
export const SERIES_ORDER_ISSUES_LIMIT_MAX = 50;

export const SeriesOrderIssuesQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(SERIES_ORDER_ISSUES_LIMIT_MAX)
    .default(SERIES_ORDER_ISSUES_LIMIT_DEFAULT),
});
export type SeriesOrderIssuesQuery = z.infer<typeof SeriesOrderIssuesQuerySchema>;

export const SeriesOrderFixInputSchema = z.object({
  expectedQueueVersion: z.string().max(64),
  strategy: SeriesOrderFixStrategySchema,
});
export type SeriesOrderFixInput = z.infer<typeof SeriesOrderFixInputSchema>;

export const SeriesOrderCheckPreferenceInputSchema = z.object({ enabled: z.boolean() });
export type SeriesOrderCheckPreferenceInput = z.infer<typeof SeriesOrderCheckPreferenceInputSchema>;

export const SeriesOrderPreferenceViewSchema = z.object({ enabled: z.boolean() });
export type SeriesOrderPreferenceView = z.infer<typeof SeriesOrderPreferenceViewSchema>;

export const SERIES_ORDER_ERROR_CODES = {
  ALREADY_IN_QUEUE: "ALREADY_IN_QUEUE",
  INVALID_FIX_STRATEGY: "INVALID_FIX_STRATEGY",
  ISSUE_STALE: "ISSUE_STALE",
  QUEUE_LIMIT_REACHED: "QUEUE_LIMIT_REACHED",
  QUEUE_STALE: "QUEUE_STALE",
} as const;
