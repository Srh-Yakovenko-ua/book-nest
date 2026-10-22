import type {
  Nullable,
  ReadingStatisticsCalendarPage,
  ReadingStatisticsCalendarPageQuery,
} from "@app/shared";

import { READING_CALENDAR_PAGE_BOUNDS } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { getYear, parseISO } from "date-fns";

import { BadRequestError } from "../../../core/exceptions/errors.js";
import { toZonedIsoDate } from "../../../core/iso-date.js";
import { ReadingHistoryProvenanceService } from "../../books/index.js";
import { UserSettingsContextService } from "../../profile/index.js";
import { resolveActivityHistoryQuality } from "../domain/activity-history-quality.js";
import { StatisticsActivityRepository } from "../infrastructure/statistics-activity.repository.js";
import { StatisticsCalendarComposer } from "./statistics-calendar.composer.js";

const CALENDAR_PAGE_MESSAGE = {
  futureYear: "A reading calendar year cannot be in the future",
} as const;

@Injectable()
export class ReadingCalendarPageService {
  constructor(
    private readonly activityRepository: StatisticsActivityRepository,
    private readonly calendarComposer: StatisticsCalendarComposer,
    private readonly readingHistoryProvenanceService: ReadingHistoryProvenanceService,
    private readonly userSettingsContextService: UserSettingsContextService,
  ) {}

  async getCalendarPage({
    query,
    userId,
  }: {
    query: ReadingStatisticsCalendarPageQuery;
    userId: string;
  }): Promise<ReadingStatisticsCalendarPage> {
    const now = new Date();
    const settings = await this.userSettingsContextService.resolve(userId);
    const today = toZonedIsoDate({ instant: now, timeZone: settings.timezone });
    const currentYear = getYear(parseISO(today));
    if (query.year > currentYear) {
      throw new BadRequestError(CALENDAR_PAGE_MESSAGE.futureYear);
    }

    const { activityReliableFrom } = await this.readingHistoryProvenanceService.ensure(userId);
    const period = resolveYearBounds({ currentYear, today, year: query.year });

    const [composition, earliestActivityDate] = await Promise.all([
      this.calendarComposer.compose({
        period,
        reliableFrom: activityReliableFrom,
        today,
        userId,
      }),
      this.activityRepository.findEarliestActivityDate(userId),
    ]);

    return {
      availableYears: listAvailableYears({ currentYear, earliestActivityDate }),
      calendar: composition.section,
      meta: {
        activityHistory: resolveActivityHistoryQuality({
          periodFrom: period.from,
          reliableFrom: activityReliableFrom,
        }),
        generatedAt: now.toISOString(),
        timezone: settings.timezone,
        weekStartDay: settings.weekStartDay,
      },
      today,
      year: query.year,
    };
  }
}

function listAvailableYears({
  currentYear,
  earliestActivityDate,
}: {
  currentYear: number;
  earliestActivityDate: Nullable<string>;
}): number[] {
  if (earliestActivityDate === null) {
    return [currentYear];
  }

  const firstYear = Math.max(
    READING_CALENDAR_PAGE_BOUNDS.earliestYear,
    Math.min(getYear(parseISO(earliestActivityDate)), currentYear),
  );
  const yearCount = currentYear - firstYear + 1;
  return Array.from({ length: yearCount }, (_unused, offset) => firstYear + offset);
}

function resolveYearBounds({
  currentYear,
  today,
  year,
}: {
  currentYear: number;
  today: string;
  year: number;
}): { from: string; to: string } {
  const paddedYear = String(year).padStart(4, "0");
  return {
    from: `${paddedYear}-01-01`,
    to: year === currentYear ? today : `${paddedYear}-12-31`,
  };
}
