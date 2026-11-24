import type {
  Nullable,
  ReadingStatisticsDateRange,
  StatisticsCalendarHistoryQuality,
  StatisticsCurrentStreak,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { DayActivity } from "../domain/reading-calendar.js";

import { ReadingHistoryProvenanceService } from "../../books/index.js";
import {
  isRangeFullyReliable,
  resolveDayHistoryQuality,
} from "../domain/activity-history-quality.js";
import { enumerateDays, toActiveDays } from "../domain/reading-calendar.js";
import { resolveCurrentStreak } from "../domain/reading-streak.js";
import { StatisticsActivityRepository } from "../infrastructure/statistics-activity.repository.js";

export type ReadingWeekActivity = {
  currentStreak: StatisticsCurrentStreak;
  days: ReadingWeekDayActivity[];
  hasReadingHistory: boolean;
  periodReliable: boolean;
};

export type ReadingWeekDayActivity = {
  booksCount: number;
  date: string;
  historyQuality: StatisticsCalendarHistoryQuality;
  pagesRead: number;
};

const NO_RECORDED_ACTIVITY = { booksCount: 0, pagesRead: 0 } as const;

@Injectable()
export class ReadingWeekService {
  constructor(
    private readonly activityRepository: StatisticsActivityRepository,
    private readonly readingHistoryProvenanceService: ReadingHistoryProvenanceService,
  ) {}

  async loadWeek({
    period,
    today,
    userId,
  }: {
    period: ReadingStatisticsDateRange;
    today: string;
    userId: string;
  }): Promise<ReadingWeekActivity> {
    const [{ activityReliableFrom }, earliestActivityDate] = await Promise.all([
      this.readingHistoryProvenanceService.ensure(userId),
      this.activityRepository.findEarliestActivityDate(userId),
    ]);
    const activity = await this.loadHistory({ earliestActivityDate, today, userId });
    const activityByDate = new Map(activity.map((day) => [day.date, day]));

    return {
      currentStreak: resolveCurrentStreak({
        activeBeforeRange: false,
        activeDays: toActiveDays(activity),
        metricRange: { from: earliestActivityDate ?? today, to: today },
        reliableFrom: activityReliableFrom,
        today,
      }),
      days: enumerateDays(period).map((date) => {
        const recorded = activityByDate.get(date) ?? NO_RECORDED_ACTIVITY;
        return {
          booksCount: recorded.booksCount,
          date,
          historyQuality: resolveDayHistoryQuality({ date, reliableFrom: activityReliableFrom }),
          pagesRead: recorded.pagesRead,
        };
      }),
      hasReadingHistory: earliestActivityDate !== null,
      periodReliable: isRangeFullyReliable({
        from: period.from,
        reliableFrom: activityReliableFrom,
      }),
    };
  }

  private async loadHistory({
    earliestActivityDate,
    today,
    userId,
  }: {
    earliestActivityDate: Nullable<string>;
    today: string;
    userId: string;
  }): Promise<DayActivity[]> {
    if (earliestActivityDate === null) {
      return [];
    }
    return this.activityRepository.aggregateDays({ from: earliestActivityDate, to: today, userId });
  }
}
