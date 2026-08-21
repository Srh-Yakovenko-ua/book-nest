import { z } from "zod";

import { BookAuthorRefSchema } from "./authors.js";
import { OwnershipStatusSchema, ReadingStatusSchema } from "./book-enums.js";
import { ReadingProgressViewSchema } from "./books.js";
import { collapseSpaces } from "./common.js";
import { NoHtmlString } from "./internal.js";
import { MediaViewSchema } from "./media.js";

export const READING_GOAL_NAME_MAX = 120;
export const READING_GOAL_TARGET_MAX = 1000;

export const READING_GOAL_PAGE_SIZE = {
  cursorMaxLength: 512,
  default: 20,
  max: 100,
} as const satisfies Record<string, number>;

export const ReadingGoalStatusSchema = z.enum(["active", "completed", "expired", "archived"]);

export type ReadingGoalStatus = z.infer<typeof ReadingGoalStatusSchema>;

export const ReadingGoalResultSchema = z.enum(["completed", "expired"]);

export type ReadingGoalResult = z.infer<typeof ReadingGoalResultSchema>;

export const ReadingGoalPaceSchema = z.enum(["ahead", "on_track", "behind", "critical"]);

export type ReadingGoalPace = z.infer<typeof ReadingGoalPaceSchema>;

export const ReadingGoalRiskLevelSchema = z.enum(["none", "low", "medium", "high", "critical"]);

export type ReadingGoalRiskLevel = z.infer<typeof ReadingGoalRiskLevelSchema>;

export const ReadingGoalRiskReasonSchema = z.enum([
  "behind_schedule",
  "deadline_soon",
  "no_recent_progress",
  "required_pace_high",
]);

export type ReadingGoalRiskReason = z.infer<typeof ReadingGoalRiskReasonSchema>;

export const ReadingGoalProjectionConfidenceSchema = z.enum(["none", "low", "medium", "high"]);

export type ReadingGoalProjectionConfidence = z.infer<typeof ReadingGoalProjectionConfidenceSchema>;

export const ReadingGoalSortSchema = z.enum([
  "created_desc",
  "created_asc",
  "deadline_asc",
  "deadline_desc",
  "progress_desc",
  "progress_asc",
  "risk_desc",
]);

export type ReadingGoalSort = z.infer<typeof ReadingGoalSortSchema>;

export const ReadingGoalBookScopeSchema = z.enum(["counted", "remaining", "all"]);

export type ReadingGoalBookScope = z.infer<typeof ReadingGoalBookScopeSchema>;

export const ReadingGoalCheckpointStatusSchema = z.enum(["achieved", "upcoming", "missed"]);

export type ReadingGoalCheckpointStatus = z.infer<typeof ReadingGoalCheckpointStatusSchema>;

export const ReadingGoalAttentionSeveritySchema = z.enum(["medium", "high", "critical"]);

export type ReadingGoalAttentionSeverity = z.infer<typeof ReadingGoalAttentionSeveritySchema>;

export const ReadingGoalActivityTypeSchema = z.enum([
  "goal_created",
  "book_counted",
  "book_uncounted",
  "target_changed",
  "deadline_changed",
  "goal_renamed",
  "goal_completed",
  "goal_expired",
  "goal_archived",
]);

export type ReadingGoalActivityType = z.infer<typeof ReadingGoalActivityTypeSchema>;

export const ReadingGoalUncountedReasonSchema = z.enum([
  "finished_date_removed",
  "finished_date_changed",
  "deadline_changed",
]);

export type ReadingGoalUncountedReason = z.infer<typeof ReadingGoalUncountedReasonSchema>;

const readingGoalCursorPageFields = {
  cursor: z.string().max(READING_GOAL_PAGE_SIZE.cursorMaxLength).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(READING_GOAL_PAGE_SIZE.max)
    .default(READING_GOAL_PAGE_SIZE.default),
};

const ReadingGoalNameSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(NoHtmlString.max(READING_GOAL_NAME_MAX, "Name must be at most 120 characters long"));

const ReadingGoalTargetCountSchema = z
  .number()
  .int()
  .min(1, "Target must be at least 1 book")
  .max(READING_GOAL_TARGET_MAX, "Target must be at most 1000 books");

export const CreateReadingGoalInputSchema = z.object({
  deadline: z.iso.date(),
  name: ReadingGoalNameSchema.optional(),
  targetCount: ReadingGoalTargetCountSchema,
});

export type CreateReadingGoalInput = z.infer<typeof CreateReadingGoalInputSchema>;

export const UpdateReadingGoalInputSchema = z.object({
  deadline: z.iso.date().optional(),
  name: ReadingGoalNameSchema.nullable().optional(),
  targetCount: ReadingGoalTargetCountSchema.optional(),
});

export type UpdateReadingGoalInput = z.infer<typeof UpdateReadingGoalInputSchema>;

export const ReadingGoalMetricsSchema = z.object({
  actualBooksPerDay: z.number().nonnegative().nullable(),
  averageDaysPerBook: z.number().nonnegative().nullable(),
  completedCount: z.number().int().nonnegative(),
  daysLeft: z.number().int().nullable(),
  daysSinceLastCounted: z.number().int().nullable(),
  elapsedDays: z.number().int().nonnegative(),
  elapsedPercent: z.number().min(0).max(100),
  expectedCompletedCount: z.number().nonnegative(),
  lastCountedAt: z.iso.date().nullable(),
  pace: ReadingGoalPaceSchema.nullable(),
  paceDeltaBooks: z.number().nullable(),
  paceDeltaPercent: z.number().nullable(),
  progressPercent: z.number().min(0).max(100),
  projectedCompletionDate: z.iso.date().nullable(),
  projectedDaysDelta: z.number().int().nullable(),
  projectionConfidence: ReadingGoalProjectionConfidenceSchema,
  remainingCount: z.number().int().nonnegative(),
  requiredBooksPerDay: z.number().nonnegative().nullable(),
  requiredDaysPerBook: z.number().nonnegative().nullable(),
  riskLevel: ReadingGoalRiskLevelSchema,
  riskReasons: z.array(ReadingGoalRiskReasonSchema),
  totalDays: z.number().int().positive(),
});

export type ReadingGoalMetrics = z.infer<typeof ReadingGoalMetricsSchema>;

const ReadingGoalCoreMetricsSchema = ReadingGoalMetricsSchema.pick({
  completedCount: true,
  daysLeft: true,
  remainingCount: true,
});

export const ReadingGoalViewSchema = z.object({
  ...ReadingGoalCoreMetricsSchema.shape,
  archivedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.date().nullable(),
  createdAt: z.iso.datetime(),
  deadline: z.iso.date(),
  id: z.string(),
  list: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable(),
  name: z.string().nullable(),
  result: ReadingGoalResultSchema.nullable(),
  status: ReadingGoalStatusSchema,
  targetCount: z.number().int().positive(),
});

export type ReadingGoalView = z.infer<typeof ReadingGoalViewSchema>;

export const ReadingGoalListItemSchema = z.object({
  ...ReadingGoalViewSchema.shape,
  ...ReadingGoalMetricsSchema.shape,
});

export type ReadingGoalListItem = z.infer<typeof ReadingGoalListItemSchema>;

export const ReadingGoalsQuerySchema = z.object({
  ...readingGoalCursorPageFields,
  listId: z.uuid().optional(),
  sort: ReadingGoalSortSchema.default("created_desc"),
  status: ReadingGoalStatusSchema.optional(),
});

export type ReadingGoalsQuery = z.infer<typeof ReadingGoalsQuerySchema>;

export const ReadingGoalListResponseSchema = z.object({
  items: z.array(ReadingGoalListItemSchema),
  nextCursor: z.string().nullable(),
});

export type ReadingGoalListResponse = z.infer<typeof ReadingGoalListResponseSchema>;

export const ReadingGoalCheckpointSchema = z.object({
  achievedAt: z.iso.date().nullable(),
  currentCompletedCount: z.number().int().nonnegative(),
  dueDate: z.iso.date(),
  status: ReadingGoalCheckpointStatusSchema,
  targetCount: z.number().int().positive(),
});

export type ReadingGoalCheckpoint = z.infer<typeof ReadingGoalCheckpointSchema>;

export const ReadingGoalBookReadingSchema = z.object({
  ...ReadingProgressViewSchema.pick({
    currentPage: true,
    finishedAt: true,
    startedAt: true,
  }).shape,
  pagesCount: z.number().int().nonnegative().nullable(),
  status: ReadingStatusSchema,
});

export type ReadingGoalBookReading = z.infer<typeof ReadingGoalBookReadingSchema>;

export const ReadingGoalBookViewSchema = z.object({
  authors: z.array(BookAuthorRefSchema),
  countedFinishedAt: z.iso.date().nullable(),
  cover: MediaViewSchema.nullable(),
  id: z.string(),
  ownershipStatus: OwnershipStatusSchema,
  qualifies: z.boolean(),
  reading: ReadingGoalBookReadingSchema,
  snapshotPosition: z.number().int().nonnegative(),
  title: z.string(),
});

export type ReadingGoalBookView = z.infer<typeof ReadingGoalBookViewSchema>;

export const ReadingGoalBooksQuerySchema = z.object({
  ...readingGoalCursorPageFields,
  scope: ReadingGoalBookScopeSchema.default("all"),
});

export type ReadingGoalBooksQuery = z.infer<typeof ReadingGoalBooksQuerySchema>;

export const ReadingGoalBooksResponseSchema = z.object({
  items: z.array(ReadingGoalBookViewSchema),
  nextCursor: z.string().nullable(),
});

export type ReadingGoalBooksResponse = z.infer<typeof ReadingGoalBooksResponseSchema>;

export const ReadingGoalActivityViewSchema = z.object({
  book: z
    .object({
      id: z.string(),
      title: z.string(),
    })
    .nullable(),
  createdAt: z.iso.datetime(),
  id: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  type: ReadingGoalActivityTypeSchema,
});

export type ReadingGoalActivityView = z.infer<typeof ReadingGoalActivityViewSchema>;

export const ReadingGoalActivityQuerySchema = z.object({
  ...readingGoalCursorPageFields,
  type: ReadingGoalActivityTypeSchema.optional(),
});

export type ReadingGoalActivityQuery = z.infer<typeof ReadingGoalActivityQuerySchema>;

export const ReadingGoalActivityResponseSchema = z.object({
  items: z.array(ReadingGoalActivityViewSchema),
  nextCursor: z.string().nullable(),
});

export type ReadingGoalActivityResponse = z.infer<typeof ReadingGoalActivityResponseSchema>;

export const ReadingGoalAttentionItemSchema = z.object({
  goalId: z.string(),
  goalName: z.string().nullable(),
  listName: z.string().nullable(),
  messageData: z.record(z.string(), z.union([z.number(), z.string()])),
  reason: ReadingGoalRiskReasonSchema,
  severity: ReadingGoalAttentionSeveritySchema,
});

export type ReadingGoalAttentionItem = z.infer<typeof ReadingGoalAttentionItemSchema>;

export const ReadingGoalBestResultSchema = z.object({
  completedAt: z.iso.date(),
  daysBeforeDeadline: z.number().int().nonnegative(),
  goalId: z.string(),
  goalName: z.string().nullable(),
  listName: z.string().nullable(),
  targetCount: z.number().int().positive(),
});

export type ReadingGoalBestResult = z.infer<typeof ReadingGoalBestResultSchema>;

export const ReadingGoalsOverviewSchema = z.object({
  active: z.object({
    needsAttention: z.number().int().nonnegative(),
    onTrack: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
  attention: z.array(ReadingGoalAttentionItemSchema),
  bestResult: ReadingGoalBestResultSchema.nullable(),
  booksCounted: z.object({
    currentYear: z.number().int().nonnegative(),
  }),
  completed: z.object({
    completedOnOrBeforeDeadline: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
  success: z.object({
    finishedGoals: z.number().int().nonnegative(),
    successfulGoals: z.number().int().nonnegative(),
    successRatePercent: z.number().min(0).max(100),
  }),
});

export type ReadingGoalsOverview = z.infer<typeof ReadingGoalsOverviewSchema>;

export const ReadingGoalDetailSchema = z.object({
  ...ReadingGoalListItemSchema.shape,
  activityPreview: z.array(ReadingGoalActivityViewSchema),
  checkpoints: z.array(ReadingGoalCheckpointSchema),
  countedBooks: z.array(ReadingGoalBookViewSchema),
  listBookCount: z.number().int().nonnegative(),
  remainingBooks: z.array(ReadingGoalBookViewSchema),
  snapshotBookCount: z.number().int().nonnegative(),
});

export type ReadingGoalDetail = z.infer<typeof ReadingGoalDetailSchema>;
