import { z } from "zod";

import { isoDay } from "./internal.js";
import { ReadingStatisticsCalendarSectionSchema } from "./reading-statistics-calendar.js";
import { ReadingStatisticsMetaSchema } from "./reading-statistics-sections.js";

export const READING_CALENDAR_PAGE_BOUNDS = { earliestYear: 1900 } as const;

export const ReadingStatisticsCalendarPageQuerySchema = z
  .object({
    year: z.coerce.number().int().min(READING_CALENDAR_PAGE_BOUNDS.earliestYear).max(9999),
  })
  .describe(
    "Which year of the reading calendar to show. The upper bound is the current year in the time zone of the user profile, and the server enforces it.",
  );

export type ReadingStatisticsCalendarPageQuery = z.infer<
  typeof ReadingStatisticsCalendarPageQuerySchema
>;

export const ReadingStatisticsCalendarPageSchema = z
  .object({
    availableYears: z.array(z.number().int()),
    calendar: ReadingStatisticsCalendarSectionSchema,
    meta: ReadingStatisticsMetaSchema,
    today: isoDay(),
    year: z.number().int(),
  })
  .describe(
    "One year of the reading calendar. availableYears lists every year from the first recorded reading progress up to the current year, ascending, and is just the current year when there is no history yet. calendar is the same section the overview returns, limited to the requested year: January 1 to today for the current year, January 1 to December 31 for a past year.",
  );

export type ReadingStatisticsCalendarPage = z.infer<typeof ReadingStatisticsCalendarPageSchema>;
