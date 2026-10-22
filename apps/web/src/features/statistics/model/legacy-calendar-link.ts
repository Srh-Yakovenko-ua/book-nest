import type { Nullable } from "@app/shared";

import { z } from "zod";

import { READING_CALENDAR_PAGE } from "./reading-calendar-params";

type SearchParamsRecord = Record<string, string | string[] | undefined>;

const LegacyCalendarLinkSchema = z.object({
  calendarMonth: z.string().optional().catch(undefined),
  period: z.string().optional().catch(undefined),
  section: z.literal("calendar"),
  year: z.string().optional().catch(undefined),
});

export function legacyReadingCalendarHref(
  source: SearchParamsRecord,
): Nullable<{ pathname: string; query: Record<string, string> }> {
  const link = LegacyCalendarLinkSchema.safeParse(source);
  if (!link.success) return null;

  const { calendarMonth, period, year } = link.data;
  const keptYear = period === undefined || period === "year" ? year : undefined;

  return {
    pathname: READING_CALENDAR_PAGE.path,
    query: {
      ...(calendarMonth === undefined ? {} : { month: calendarMonth }),
      ...(keptYear === undefined ? {} : { year: keptYear }),
    },
  };
}
