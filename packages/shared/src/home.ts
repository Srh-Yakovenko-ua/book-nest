import { z } from "zod";

import { BookAuthorRefSchema } from "./authors.js";
import {
  LoanTypeSchema,
  OwnershipStatusSchema,
  QueuePriorityReasonSchema,
  QueuePrioritySchema,
  ReadingStatusSchema,
} from "./book-enums.js";
import { CountSchema, isoDay } from "./internal.js";
import { MediaViewSchema } from "./media.js";
import { WeekStartDaySchema } from "./profile.js";
import { ReadingGoalRiskReasonSchema } from "./reading-goals.js";
import { StatisticsCurrentStreakSchema } from "./reading-statistics-calendar.js";
import { ReadingStatisticsGoalSectionSchema } from "./reading-statistics-sections.js";

export const HOME_DASHBOARD_RULES = {
  activeBooks: { pageSize: 6, staleAfterDays: 7 },
  attention: { queueDeadlineDays: 7, queueUrgentDays: 1, visibleGroups: 3 },
  nextRead: { candidateLimit: 10, longOnShelfDays: 365 },
  recent: { booksWindowDays: 30, goalCompletionWindowDays: 7 },
  week: { daysCount: 7 },
} as const;

export const HomeSectionUnavailableReasonSchema = z.enum(["SOURCE_FAILED"]);

export type HomeSectionUnavailableReason = z.infer<typeof HomeSectionUnavailableReasonSchema>;

function homeSectionSchema<TData extends z.ZodType>(data: TData) {
  return z.discriminatedUnion("status", [
    z.object({ data, status: z.literal("available") }),
    z.object({ reason: HomeSectionUnavailableReasonSchema, status: z.literal("unavailable") }),
  ]);
}

const HomeBookSeriesRefSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  partNumber: z.number().int().nullable(),
});

export const HomeActiveReadingStatusSchema = ReadingStatusSchema.extract(["reading", "rereading"]);

export type HomeActiveReadingStatus = z.infer<typeof HomeActiveReadingStatusSchema>;

export const HomeActiveBookSchema = z.object({
  authors: z.array(BookAuthorRefSchema),
  cover: MediaViewSchema.nullable(),
  currentPage: CountSchema.nullable(),
  cycleStartedAt: isoDay().nullable(),
  id: z.uuid(),
  lastProgressAt: isoDay()
    .nullable()
    .describe(
      "Date of the latest recorded progress event of the current reading cycle. Null when the current cycle has no recorded progress yet.",
    ),
  pagesCount: CountSchema.nullable(),
  progressPercent: z.number().min(0).max(100).nullable(),
  readingStatus: HomeActiveReadingStatusSchema,
  series: HomeBookSeriesRefSchema.nullable(),
  title: z.string(),
});

export type HomeActiveBook = z.infer<typeof HomeActiveBookSchema>;

export const HomeActiveBooksPageSchema = z
  .object({
    items: z.array(HomeActiveBookSchema),
    nextCursor: z.string().nullable(),
    total: CountSchema,
  })
  .describe(
    "Books in reading or rereading, ordered by the latest progress of the current cycle, then the cycle start, unknown last, ties by id. nextCursor is opaque.",
  );

export type HomeActiveBooksPage = z.infer<typeof HomeActiveBooksPageSchema>;

export const HomeActiveBooksQuerySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
});

export type HomeActiveBooksQuery = z.infer<typeof HomeActiveBooksQuerySchema>;

export const HomeReadingWeekDayStatusSchema = z.enum(["active", "inactive", "unknown", "future"]);

export type HomeReadingWeekDayStatus = z.infer<typeof HomeReadingWeekDayStatusSchema>;

export const HomeReadingWeekDaySchema = z.object({
  booksCount: CountSchema.nullable(),
  date: isoDay(),
  pagesRead: CountSchema.nullable(),
  status: HomeReadingWeekDayStatusSchema,
});

export type HomeReadingWeekDay = z.infer<typeof HomeReadingWeekDaySchema>;

export const HomeReadingWeekPagesSchema = z.discriminatedUnion("quality", [
  z.object({ quality: z.literal("exact"), value: CountSchema }),
  z.object({ quality: z.literal("lower_bound"), value: CountSchema }),
  z.object({ quality: z.literal("unavailable") }),
]);

export type HomeReadingWeekPages = z.infer<typeof HomeReadingWeekPagesSchema>;

export const HomeReadingWeekSchema = z
  .object({
    activeDays: CountSchema,
    currentStreak: StatisticsCurrentStreakSchema,
    days: z.array(HomeReadingWeekDaySchema).length(HOME_DASHBOARD_RULES.week.daysCount),
    hasReadingHistory: z.boolean(),
    pages: HomeReadingWeekPagesSchema,
    period: z.object({ from: isoDay(), to: isoDay() }),
    timezone: z.string(),
    today: isoDay(),
    weekStartDay: WeekStartDaySchema,
  })
  .describe(
    "The current calendar week in the reader's timezone and week start. currentStreak is the global current streak, not clipped to the week.",
  );

export type HomeReadingWeek = z.infer<typeof HomeReadingWeekSchema>;

export const HomeGoalRecentCompletionSchema = z.object({
  completedAt: isoDay(),
  goalId: z.uuid(),
  listName: z.string().nullable(),
  name: z.string().nullable(),
  targetCount: z.number().int().positive(),
});

export type HomeGoalRecentCompletion = z.infer<typeof HomeGoalRecentCompletionSchema>;

export const HomeGoalSectionSchema = ReadingStatisticsGoalSectionSchema.extend({
  recentCompletion: HomeGoalRecentCompletionSchema.nullable(),
});

export type HomeGoalSection = z.infer<typeof HomeGoalSectionSchema>;

export const HomeReadingViewSchema = z.object({
  currentlyReading: homeSectionSchema(HomeActiveBooksPageSchema),
  readingGoal: homeSectionSchema(HomeGoalSectionSchema),
  readingWeek: homeSectionSchema(HomeReadingWeekSchema),
  today: isoDay(),
});

export type HomeReadingView = z.infer<typeof HomeReadingViewSchema>;

export const HomeNextReadSourceSchema = z.enum(["queue", "favorite_series", "library"]);

export type HomeNextReadSource = z.infer<typeof HomeNextReadSourceSchema>;

export const HomeNextReadReasonSchema = z.enum([
  "queue_next",
  "favorite_series",
  "favorite_planned",
  "planned",
  "favorite_on_shelf",
  "long_on_shelf",
  "discovery",
]);

export type HomeNextReadReason = z.infer<typeof HomeNextReadReasonSchema>;

export const HomeNextReadActionSchema = z.enum(["start", "resume"]);

export type HomeNextReadAction = z.infer<typeof HomeNextReadActionSchema>;

export const HomeNextReadBookStatusSchema = ReadingStatusSchema.extract([
  "not_started",
  "want_to_read",
  "paused",
]);

export const HomeNextReadCandidateSchema = z.object({
  action: HomeNextReadActionSchema,
  book: z.object({
    authors: z.array(BookAuthorRefSchema),
    cover: MediaViewSchema.nullable(),
    currentPage: CountSchema.nullable(),
    id: z.uuid(),
    isFavorite: z.boolean(),
    ownershipStatus: OwnershipStatusSchema,
    pagesCount: CountSchema.nullable(),
    progressPercent: z.number().min(0).max(100).nullable(),
    readingStatus: HomeNextReadBookStatusSchema,
    title: z.string(),
  }),
  queue: z
    .object({
      position: z.number().int().positive(),
      priority: QueuePrioritySchema.nullable(),
      reason: QueuePriorityReasonSchema.nullable(),
      targetDate: isoDay().nullable(),
    })
    .nullable(),
  reason: HomeNextReadReasonSchema,
  series: HomeBookSeriesRefSchema.nullable(),
  source: HomeNextReadSourceSchema,
});

export type HomeNextReadCandidate = z.infer<typeof HomeNextReadCandidateSchema>;

export const HomeNextReadViewSchema = z
  .object({
    candidates: z
      .array(HomeNextReadCandidateSchema)
      .max(HOME_DASHBOARD_RULES.nextRead.candidateLimit),
    unavailableSources: z.array(HomeNextReadSourceSchema),
  })
  .describe(
    "Up to ten unique candidates in rank order: queue by position, then favorite series continuations, then library groups. unavailableSources lists sources that failed, so an empty list of candidates is not proof of absence.",
  );

export type HomeNextReadView = z.infer<typeof HomeNextReadViewSchema>;

export const HomeAttentionSeveritySchema = z.enum(["low", "medium", "high", "critical"]);

export type HomeAttentionSeverity = z.infer<typeof HomeAttentionSeveritySchema>;

export const HomeAttentionSourceSchema = z.enum([
  "deliveries",
  "loans",
  "goals",
  "reading",
  "series_order",
  "queue",
]);

export type HomeAttentionSource = z.infer<typeof HomeAttentionSourceSchema>;

export const HomeAttentionUnitSchema = z.enum(["parcels", "orders", "books", "goals", "issues"]);

export type HomeAttentionUnit = z.infer<typeof HomeAttentionUnitSchema>;

const attentionGroupBase = {
  count: z.number().int().positive(),
  dueDate: isoDay().nullable(),
  id: z.string(),
  severity: HomeAttentionSeveritySchema,
  unit: HomeAttentionUnitSchema,
};

export const HomeAttentionGroupSchema = z.discriminatedUnion("reason", [
  z.object({
    ...attentionGroupBase,
    expiredCount: CountSchema,
    reason: z.literal("delivery_pickup_expiring"),
  }),
  z.object({ ...attentionGroupBase, reason: z.literal("delivery_ready_for_pickup") }),
  z.object({
    ...attentionGroupBase,
    maxDelayDays: z.number().int().positive(),
    reason: z.literal("delivery_delayed"),
  }),
  z.object({
    ...attentionGroupBase,
    maxWaitingDays: z.number().int().positive(),
    reason: z.literal("delivery_awaiting_dispatch"),
  }),
  z.object({
    ...attentionGroupBase,
    ordersCount: CountSchema,
    reason: z.literal("delivery_unassigned_books"),
    revealOrderId: z.uuid().nullable(),
  }),
  z.object({
    ...attentionGroupBase,
    direction: LoanTypeSchema,
    reason: z.literal("loan_overdue"),
  }),
  z.object({
    ...attentionGroupBase,
    direction: LoanTypeSchema,
    reason: z.literal("loan_return_soon"),
  }),
  z.object({
    ...attentionGroupBase,
    goalId: z.uuid(),
    goalName: z.string().nullable(),
    isPrimary: z.boolean(),
    listName: z.string().nullable(),
    reason: z.literal("goal_at_risk"),
    riskReason: ReadingGoalRiskReasonSchema,
  }),
  z.object({
    ...attentionGroupBase,
    bookId: z.uuid().nullable(),
    bookTitle: z.string().nullable(),
    reason: z.literal("reading_stale"),
  }),
  z.object({
    ...attentionGroupBase,
    reason: z.literal("series_order_issue"),
    seriesId: z.uuid().nullable(),
    seriesTitle: z.string().nullable(),
  }),
  z.object({
    ...attentionGroupBase,
    bookId: z.uuid().nullable(),
    bookTitle: z.string().nullable(),
    queueReasons: z.array(QueuePriorityReasonSchema),
    reason: z.literal("queue_deadline"),
  }),
]);

export type HomeAttentionGroup = z.infer<typeof HomeAttentionGroupSchema>;

export type HomeAttentionReason = HomeAttentionGroup["reason"];

export const HomeAttentionViewSchema = z
  .object({
    groups: z.array(HomeAttentionGroupSchema),
    unavailableSources: z.array(HomeAttentionSourceSchema),
  })
  .describe(
    "Actionable signals grouped by reason, severity and action after entity dedupe, sorted by severity, due date, type rank and id. A non-empty unavailableSources means the list is incomplete, never an all-clear.",
  );

export type HomeAttentionView = z.infer<typeof HomeAttentionViewSchema>;
