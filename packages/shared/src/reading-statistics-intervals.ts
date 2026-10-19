import { differenceInCalendarDays, isAfter, parseISO } from "date-fns";
import { z } from "zod";

import { CountSchema, isoDay } from "./internal.js";
import { StatisticsCalendarHistoryQualitySchema } from "./reading-statistics-calendar.js";
import {
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
