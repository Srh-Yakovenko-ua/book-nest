import { z } from "zod";

import { createPaginatedSchema, LIST_PAGE_SIZE_MAX } from "./common.js";

const TIMELINE_NAME_MIN = 1;
const TIMELINE_NAME_MAX = 100;
const TIMELINE_DESCRIPTION_MAX = 500;

const EVENT_TITLE_MIN = 1;
const EVENT_TITLE_MAX = 150;
const EVENT_SUMMARY_MAX = 300;
const EVENT_DESCRIPTION_MAX = 5000;
const EVENT_CHAPTER_MAX = 100;
const EVENT_LOCATION_MAX = 200;
const EVENT_STORY_TIME_MAX = 100;
const EVENT_PERSONAL_NOTE_MAX = 3000;
const EVENT_SEARCH_MAX = 100;
const EVENTS_DEFAULT_PAGE_SIZE = 50;

export const TIMELINE_EVENT_PAGE_MAX = 2147483647;

export const TIMELINE_ERROR_CODES = {
  bookNotFound: "timeline_book_not_found",
  crossBookRelation: "timeline_cross_book_relation",
  defaultTimelineDelete: "timeline_default_delete_forbidden",
  deleteStrategyRequired: "timeline_delete_strategy_required",
  duplicateName: "timeline_duplicate_name",
  duplicateRelation: "timeline_duplicate_relation",
  eventNotFound: "timeline_event_not_found",
  invalidNeighbor: "timeline_invalid_neighbor",
  invalidResolvedBy: "timeline_invalid_resolved_by",
  invalidTargetTimeline: "timeline_invalid_target_timeline",
  pageExceedsBook: "timeline_page_exceeds_book",
  relationNotFound: "timeline_relation_not_found",
  reorderConflict: "timeline_reorder_conflict",
  selfRelation: "timeline_self_relation",
  targetTimelineRequired: "timeline_target_timeline_required",
  timelineNotFound: "timeline_not_found",
} as const;

export const TIMELINE_COLOR_KEYS = [
  "slate",
  "stone",
  "amber",
  "orange",
  "rose",
  "red",
  "emerald",
  "teal",
  "sky",
  "blue",
  "violet",
  "fuchsia",
] as const;

export const TimelineColorKeySchema = z.enum(TIMELINE_COLOR_KEYS);

export type TimelineColorKey = z.infer<typeof TimelineColorKeySchema>;

export const TIMELINE_EVENT_TYPES = [
  "main",
  "mystery",
  "character_appearance",
  "death",
  "betrayal",
  "battle",
  "romance",
  "conflict",
  "travel",
  "magic",
  "politics",
  "conversation",
  "twist",
  "other",
] as const;

export const TimelineEventTypeSchema = z.enum(TIMELINE_EVENT_TYPES);

export type TimelineEventType = z.infer<typeof TimelineEventTypeSchema>;

export const TIMELINE_IMPORTANCE_LEVELS = ["low", "medium", "high", "key"] as const;

export const TimelineImportanceSchema = z.enum(TIMELINE_IMPORTANCE_LEVELS);

export type TimelineImportance = z.infer<typeof TimelineImportanceSchema>;

export const TimelineRelationTypeSchema = z.enum(["follows_from", "foreshadows", "related"]);

export type TimelineRelationType = z.infer<typeof TimelineRelationTypeSchema>;

export const TimelineThreadStatusSchema = z.enum(["open", "resolved"]);

export type TimelineThreadStatus = z.infer<typeof TimelineThreadStatusSchema>;

export const TimelineRelationDirectionSchema = z.enum(["incoming", "outgoing"]);

export type TimelineRelationDirection = z.infer<typeof TimelineRelationDirectionSchema>;

export const TimelineEventSortSchema = z.enum([
  "book_order",
  "timeline_order",
  "importance",
  "newest",
  "oldest",
]);

export type TimelineEventSort = z.infer<typeof TimelineEventSortSchema>;

export const TimelineDeleteStrategySchema = z.enum(["move", "delete"]);

export type TimelineDeleteStrategy = z.infer<typeof TimelineDeleteStrategySchema>;

export const TimelineReorderScopeSchema = z.enum(["book", "timeline"]);

export type TimelineReorderScope = z.infer<typeof TimelineReorderScopeSchema>;

const QueryBooleanSchema = z.enum(["true", "false"]).transform((value) => value === "true");

const parseCsvList = (raw: unknown): string[] | undefined => {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  const parts = (Array.isArray(raw) ? raw : [raw])
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return parts.length === 0 ? undefined : parts;
};

const multiEnumQuery = <ItemSchema extends z.ZodType>(item: ItemSchema) =>
  z.preprocess(parseCsvList, z.array(item).optional());

export const CreateTimelineInputSchema = z.object({
  colorKey: TimelineColorKeySchema.nullish(),
  description: z.string().trim().max(TIMELINE_DESCRIPTION_MAX).nullish(),
  name: z.string().trim().min(TIMELINE_NAME_MIN).max(TIMELINE_NAME_MAX),
});

export type CreateTimelineInput = z.infer<typeof CreateTimelineInputSchema>;

export const UpdateTimelineInputSchema = z.object({
  colorKey: TimelineColorKeySchema.nullish(),
  description: z.string().trim().max(TIMELINE_DESCRIPTION_MAX).nullish(),
  name: z.string().trim().min(TIMELINE_NAME_MIN).max(TIMELINE_NAME_MAX).optional(),
});

export type UpdateTimelineInput = z.infer<typeof UpdateTimelineInputSchema>;

export const ReorderTimelinesInputSchema = z
  .object({
    afterTimelineId: z.string().uuid().optional(),
    beforeTimelineId: z.string().uuid().optional(),
    expectedUpdatedAt: z.iso.datetime(),
    timelineId: z.string().uuid(),
  })
  .refine((value) => value.afterTimelineId !== undefined || value.beforeTimelineId !== undefined, {
    message: "afterTimelineId or beforeTimelineId is required",
    path: ["afterTimelineId"],
  });

export type ReorderTimelinesInput = z.infer<typeof ReorderTimelinesInputSchema>;

export const SetDefaultTimelineInputSchema = z.object({
  expectedUpdatedAt: z.iso.datetime().optional(),
});

export type SetDefaultTimelineInput = z.infer<typeof SetDefaultTimelineInputSchema>;

export const DeleteTimelineQuerySchema = z.object({
  strategy: TimelineDeleteStrategySchema.optional(),
  targetTimelineId: z.string().uuid().optional(),
});

export type DeleteTimelineQuery = z.infer<typeof DeleteTimelineQuerySchema>;

export const CreateTimelineEventInputSchema = z.object({
  chapter: z.string().trim().max(EVENT_CHAPTER_MAX).nullish(),
  description: z.string().trim().max(EVENT_DESCRIPTION_MAX).nullish(),
  eventType: TimelineEventTypeSchema.default("main"),
  importance: TimelineImportanceSchema.default("medium"),
  location: z.string().trim().max(EVENT_LOCATION_MAX).nullish(),
  pageNumber: z.coerce.number().int().positive().max(TIMELINE_EVENT_PAGE_MAX).nullish(),
  personalNote: z.string().trim().max(EVENT_PERSONAL_NOTE_MAX).nullish(),
  resolvedByEventId: z.string().uuid().nullish(),
  storyTime: z.string().trim().max(EVENT_STORY_TIME_MAX).nullish(),
  summary: z.string().trim().max(EVENT_SUMMARY_MAX).nullish(),
  threadStatus: TimelineThreadStatusSchema.nullish(),
  timelineId: z.string().uuid().optional(),
  title: z.string().trim().min(EVENT_TITLE_MIN).max(EVENT_TITLE_MAX),
});

export type CreateTimelineEventInput = z.infer<typeof CreateTimelineEventInputSchema>;

export const UpdateTimelineEventInputSchema = z.object({
  chapter: z.string().trim().max(EVENT_CHAPTER_MAX).nullish(),
  description: z.string().trim().max(EVENT_DESCRIPTION_MAX).nullish(),
  eventType: TimelineEventTypeSchema.optional(),
  importance: TimelineImportanceSchema.optional(),
  location: z.string().trim().max(EVENT_LOCATION_MAX).nullish(),
  pageNumber: z.coerce.number().int().positive().max(TIMELINE_EVENT_PAGE_MAX).nullish(),
  personalNote: z.string().trim().max(EVENT_PERSONAL_NOTE_MAX).nullish(),
  resolvedByEventId: z.string().uuid().nullish(),
  storyTime: z.string().trim().max(EVENT_STORY_TIME_MAX).nullish(),
  summary: z.string().trim().max(EVENT_SUMMARY_MAX).nullish(),
  threadStatus: TimelineThreadStatusSchema.nullish(),
  title: z.string().trim().min(EVENT_TITLE_MIN).max(EVENT_TITLE_MAX).optional(),
});

export type UpdateTimelineEventInput = z.infer<typeof UpdateTimelineEventInputSchema>;

export const ReorderTimelineEventInputSchema = z
  .object({
    afterEventId: z.string().uuid().optional(),
    beforeEventId: z.string().uuid().optional(),
    expectedUpdatedAt: z.iso.datetime(),
    scope: TimelineReorderScopeSchema,
  })
  .refine((value) => value.afterEventId !== undefined || value.beforeEventId !== undefined, {
    message: "afterEventId or beforeEventId is required",
    path: ["afterEventId"],
  });

export type ReorderTimelineEventInput = z.infer<typeof ReorderTimelineEventInputSchema>;

export const MoveTimelineEventInputSchema = z.object({
  afterEventId: z.string().uuid().optional(),
  beforeEventId: z.string().uuid().optional(),
  expectedUpdatedAt: z.iso.datetime().optional(),
  targetTimelineId: z.string().uuid(),
});

export type MoveTimelineEventInput = z.infer<typeof MoveTimelineEventInputSchema>;

export const CreateEventRelationInputSchema = z.object({
  relationType: TimelineRelationTypeSchema,
  targetEventId: z.string().uuid(),
});

export type CreateEventRelationInput = z.infer<typeof CreateEventRelationInputSchema>;

export const TimelineEventsQuerySchema = z.object({
  eventType: multiEnumQuery(TimelineEventTypeSchema),
  importance: multiEnumQuery(TimelineImportanceSchema),
  important: QueryBooleanSchema.optional(),
  keyOnly: QueryBooleanSchema.optional(),
  pageNumber: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(LIST_PAGE_SIZE_MAX)
    .default(EVENTS_DEFAULT_PAGE_SIZE),
  recap: QueryBooleanSchema.optional(),
  search: z.string().trim().max(EVENT_SEARCH_MAX).optional(),
  sort: TimelineEventSortSchema.default("book_order"),
  timelineId: z.string().uuid().optional(),
  unresolved: QueryBooleanSchema.optional(),
});

export type TimelineEventsQuery = z.infer<typeof TimelineEventsQuerySchema>;

export const TimelineViewSchema = z.object({
  colorKey: TimelineColorKeySchema.nullable(),
  createdAt: z.string(),
  description: z.string().nullable(),
  eventsCount: z.number().int().nonnegative(),
  id: z.string(),
  isDefault: z.boolean(),
  name: z.string(),
  position: z.number().int(),
  updatedAt: z.string(),
});

export type TimelineView = z.infer<typeof TimelineViewSchema>;

export const TimelineListViewSchema = z.object({
  timelines: z.array(TimelineViewSchema),
});

export type TimelineListView = z.infer<typeof TimelineListViewSchema>;

export const TimelineEventPreviewSchema = z.object({
  bookOrder: z.number().int(),
  chapter: z.string().nullable(),
  id: z.string(),
  pageNumber: z.number().int().nullable(),
  timelineId: z.string(),
  timelineName: z.string(),
  title: z.string(),
});

export type TimelineEventPreview = z.infer<typeof TimelineEventPreviewSchema>;

export const TimelineEventViewSchema = z.object({
  bookId: z.string(),
  bookOrder: z.number().int(),
  chapter: z.string().nullable(),
  createdAt: z.string(),
  description: z.string().nullable(),
  eventType: TimelineEventTypeSchema,
  id: z.string(),
  importance: TimelineImportanceSchema,
  location: z.string().nullable(),
  pageNumber: z.number().int().nullable(),
  personalNote: z.string().nullable(),
  resolvedByEventId: z.string().nullable(),
  storyTime: z.string().nullable(),
  summary: z.string().nullable(),
  threadStatus: TimelineThreadStatusSchema.nullable(),
  timelineColorKey: TimelineColorKeySchema.nullable(),
  timelineId: z.string(),
  timelineName: z.string(),
  timelineOrder: z.number().int(),
  title: z.string(),
  updatedAt: z.string(),
});

export type TimelineEventView = z.infer<typeof TimelineEventViewSchema>;

export const TimelineEventRelationEntrySchema = z.object({
  direction: TimelineRelationDirectionSchema,
  event: TimelineEventPreviewSchema,
  id: z.string(),
  relationType: TimelineRelationTypeSchema,
});

export type TimelineEventRelationEntry = z.infer<typeof TimelineEventRelationEntrySchema>;

export const TimelineEventRelationsViewSchema = z.object({
  incoming: z.array(TimelineEventRelationEntrySchema),
  outgoing: z.array(TimelineEventRelationEntrySchema),
});

export type TimelineEventRelationsView = z.infer<typeof TimelineEventRelationsViewSchema>;

export const TimelineEventDetailViewSchema = TimelineEventViewSchema.extend({
  relations: TimelineEventRelationsViewSchema,
  resolvedBy: TimelineEventPreviewSchema.nullable(),
  resolves: z.array(TimelineEventPreviewSchema),
});

export type TimelineEventDetailView = z.infer<typeof TimelineEventDetailViewSchema>;

export const CreatedEventRelationViewSchema = z.object({
  createdAt: z.string(),
  id: z.string(),
  relationType: TimelineRelationTypeSchema,
  sourceEventId: z.string(),
  target: TimelineEventPreviewSchema,
  targetEventId: z.string(),
});

export type CreatedEventRelationView = z.infer<typeof CreatedEventRelationViewSchema>;

export const PaginatedTimelineEventsSchema = createPaginatedSchema(TimelineEventViewSchema);

export const TimelineSummaryEntrySchema = z.object({
  eventsCount: z.number().int().nonnegative(),
  timelineId: z.string(),
});

export type TimelineSummaryEntry = z.infer<typeof TimelineSummaryEntrySchema>;

export const TimelineSummaryViewSchema = z.object({
  timelines: z.array(TimelineSummaryEntrySchema),
  totalEvents: z.number().int().nonnegative(),
});

export type TimelineSummaryView = z.infer<typeof TimelineSummaryViewSchema>;

export const TimelineTypeDistributionSchema = z.object({
  count: z.number().int().nonnegative(),
  eventType: TimelineEventTypeSchema,
});

export const TimelineImportanceDistributionSchema = z.object({
  count: z.number().int().nonnegative(),
  importance: TimelineImportanceSchema,
});

export const TimelineLineDistributionSchema = z.object({
  colorKey: TimelineColorKeySchema.nullable(),
  count: z.number().int().nonnegative(),
  timelineId: z.string(),
  timelineName: z.string(),
});

export const TimelineChapterDensitySchema = z.object({
  chapter: z.string().nullable(),
  count: z.number().int().nonnegative(),
});

export const TimelineReadingPositionSchema = z.object({
  currentPage: z.number().int().nullable(),
  guardDefault: z.boolean(),
  positionKnown: z.boolean(),
});

export type TimelineReadingPosition = z.infer<typeof TimelineReadingPositionSchema>;

export const TimelineOverviewViewSchema = z.object({
  byImportance: z.array(TimelineImportanceDistributionSchema),
  byTimeline: z.array(TimelineLineDistributionSchema),
  byType: z.array(TimelineTypeDistributionSchema),
  chapterDensity: z.array(TimelineChapterDensitySchema),
  eventsAfterPosition: z.number().int().nonnegative(),
  eventsBeforePosition: z.number().int().nonnegative(),
  eventsUnknownPosition: z.number().int().nonnegative(),
  readingPosition: TimelineReadingPositionSchema,
  totalEvents: z.number().int().nonnegative(),
  unresolvedCount: z.number().int().nonnegative(),
});

export type TimelineOverviewView = z.infer<typeof TimelineOverviewViewSchema>;
