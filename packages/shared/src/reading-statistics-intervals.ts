import { differenceInCalendarDays, isAfter, parseISO } from "date-fns";
import { z } from "zod";

import type { Nullable } from "./common.js";
import type { CompletedReadsFilter } from "./reading-statistics-common.js";

import { BookLanguageSchema } from "./book-enums.js";
import { GenreKeySchema } from "./genres.js";
import { CountSchema, isoDay } from "./internal.js";
import { StatisticsCalendarHistoryQualitySchema } from "./reading-statistics-calendar.js";
import {
  READING_STATISTICS_CUSTOM_PERIOD_BOUNDS,
  ReadingStatisticsDateRangeSchema,
  StatisticsBookRefSchema,
} from "./reading-statistics-common.js";
import { CompletedReadRefSchema } from "./reading-statistics-tastes.js";

const READING_STATISTICS_INTERVAL = {
  cursorMaxLength: 512,
  defaultPageSize: 20,
  maxDays: 366,
  maxPageSize: 50,
} as const satisfies Record<string, number>;

export const ReadingStatisticsIntervalQuerySchema = z
  .object({
    cursor: z.string().max(READING_STATISTICS_INTERVAL.cursorMaxLength).optional(),
    from: isoDay(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(READING_STATISTICS_INTERVAL.maxPageSize)
      .default(READING_STATISTICS_INTERVAL.defaultPageSize),
    to: isoDay(),
  })
  .superRefine(({ from, to }, context) => {
    if (isAfter(parseISO(from), parseISO(to))) {
      context.addIssue({ code: "custom", message: "from must not be after to", path: ["from"] });
      return;
    }
    if (
      differenceInCalendarDays(parseISO(to), parseISO(from)) >= READING_STATISTICS_INTERVAL.maxDays
    ) {
      context.addIssue({
        code: "custom",
        message: `an interval covers at most ${String(READING_STATISTICS_INTERVAL.maxDays)} days`,
        path: ["to"],
      });
    }
  })
  .describe(
    "One chart bucket to open: the exact inclusive day range the bucket covers, already clipped to its period, plus a page of results. The range is bounded so a detail request never scans the whole history.",
  );

export type ReadingStatisticsIntervalQuery = z.infer<typeof ReadingStatisticsIntervalQuerySchema>;

export const ReadingStatisticsCompletedReadsPageSchema = z
  .object({
    items: z.array(CompletedReadRefSchema),
    nextCursor: z.string().nullable(),
    range: ReadingStatisticsDateRangeSchema,
    totalCount: CountSchema,
  })
  .describe(
    "Every finished reading cycle whose finish date falls inside the range, newest first. A reread is its own row, and a book moved to trash keeps its rows.",
  );

export type ReadingStatisticsCompletedReadsPage = z.infer<
  typeof ReadingStatisticsCompletedReadsPageSchema
>;

export const ReadingStatisticsSubsetFilterSchema = z
  .discriminatedUnion("field", [
    z.object({ field: z.literal("authorId"), value: z.uuid() }),
    z.object({ field: z.literal("genre"), value: GenreKeySchema }),
    z.object({ field: z.literal("language"), value: BookLanguageSchema }),
    z.object({ field: z.literal("publisherId"), value: z.uuid() }),
  ])
  .describe(
    "The one historical attribute a completed reads subset narrows by, matched against the metadata captured when each read was finished.",
  );

export type ReadingStatisticsSubsetFilter = z.infer<typeof ReadingStatisticsSubsetFilterSchema>;

export function pickReadingStatisticsSubsetFilter({
  authorId,
  genre,
  language,
  publisherId,
}: Pick<
  CompletedReadsFilter,
  "authorId" | "genre" | "language" | "publisherId"
>): Nullable<ReadingStatisticsSubsetFilter> {
  const candidates = [
    authorId === undefined ? null : { field: "authorId", value: authorId },
    genre === undefined ? null : { field: "genre", value: genre },
    language === undefined ? null : { field: "language", value: language },
    publisherId === undefined ? null : { field: "publisherId", value: publisherId },
  ].filter((candidate) => candidate !== null);
  if (candidates.length !== 1) {
    return null;
  }

  const parsed = ReadingStatisticsSubsetFilterSchema.safeParse(candidates[0]);
  return parsed.success ? parsed.data : null;
}

export const ReadingStatisticsCompletedReadsSubsetQuerySchema = z
  .strictObject({
    authorId: z.uuid().optional(),
    cursor: z.string().max(READING_STATISTICS_INTERVAL.cursorMaxLength).optional(),
    genre: GenreKeySchema.optional(),
    language: BookLanguageSchema.optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(READING_STATISTICS_INTERVAL.maxPageSize)
      .default(READING_STATISTICS_INTERVAL.defaultPageSize),
    periodFrom: isoDay().optional(),
    periodTo: isoDay(),
    publisherId: z.uuid().optional(),
  })
  .superRefine((query, context) => {
    if (pickReadingStatisticsSubsetFilter(query) === null) {
      context.addIssue({
        code: "custom",
        message: "exactly one of authorId, genre, language or publisherId is required",
        path: ["filter"],
      });
    }
    if (query.periodFrom === undefined) {
      return;
    }

    const from = parseISO(query.periodFrom);
    const to = parseISO(query.periodTo);
    if (isAfter(from, to)) {
      context.addIssue({
        code: "custom",
        message: "periodFrom must not be after periodTo",
        path: ["periodFrom"],
      });
      return;
    }
    if (differenceInCalendarDays(to, from) >= READING_STATISTICS_CUSTOM_PERIOD_BOUNDS.maxDays) {
      context.addIssue({
        code: "custom",
        message: `a period covers at most ${String(READING_STATISTICS_CUSTOM_PERIOD_BOUNDS.maxDays)} days`,
        path: ["periodTo"],
      });
    }
  })
  .describe(
    "One taste ranking row to open: the inclusive period of the overview it came from, where a missing periodFrom means all time, plus exactly one attribute and a page of results.",
  );

export type ReadingStatisticsCompletedReadsSubsetQuery = z.infer<
  typeof ReadingStatisticsCompletedReadsSubsetQuerySchema
>;

export const ReadingStatisticsCompletedReadsSubsetPageSchema = z
  .object({
    items: z.array(CompletedReadRefSchema),
    nextCursor: z.string().nullable(),
    totalCount: CountSchema,
  })
  .describe(
    "Every finished reading cycle inside the period whose completion snapshot carries the attribute, newest first. totalCount covers the whole subset and equals the count shown on the ranking row.",
  );

export type ReadingStatisticsCompletedReadsSubsetPage = z.infer<
  typeof ReadingStatisticsCompletedReadsSubsetPageSchema
>;

export const ReadingStatisticsActivityContributionSchema = z.object({
  book: StatisticsBookRefSchema,
  date: isoDay(),
  pagesRead: CountSchema,
});

export type ReadingStatisticsActivityContribution = z.infer<
  typeof ReadingStatisticsActivityContributionSchema
>;

export const ReadingStatisticsActivityPageSchema = z
  .object({
    activeDays: CountSchema,
    booksCount: CountSchema,
    historyQuality: StatisticsCalendarHistoryQualitySchema,
    items: z.array(ReadingStatisticsActivityContributionSchema),
    nextCursor: z.string().nullable(),
    pagesRead: CountSchema,
    range: ReadingStatisticsDateRangeSchema,
    reliableFrom: isoDay(),
  })
  .describe(
    "The recorded page progress inside the range, one row per day and book, newest day first. The totals cover the whole range, not just this page. historyQuality legacy_observed_only means the range starts before reliableFrom, so the rows are what survived rather than everything that was read.",
  );

export type ReadingStatisticsActivityPage = z.infer<typeof ReadingStatisticsActivityPageSchema>;
