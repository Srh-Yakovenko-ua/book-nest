import type {
  Nullable,
  ReadingStatisticsCalendarSection,
  ReadingStatisticsDateRange,
  StatisticsMostActiveWeekday,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { DayActivity, DayBookActivity } from "../domain/reading-calendar.js";
import type { DayBookWithPresentation } from "../infrastructure/statistics-activity.repository.js";

import { MediaService } from "../../media/index.js";
import { isRangeFullyReliable } from "../domain/activity-history-quality.js";
import {
  buildCalendarDays,
  buildWeekdayActivity,
  countEligibleDays,
  findMostActiveWeekday,
  toActiveDays,
} from "../domain/reading-calendar.js";
import { findLongestStreak, resolveCurrentStreak } from "../domain/reading-streak.js";
import { rollingYearStart } from "../domain/statistics-period.js";
import { StatisticsActivityRepository } from "../infrastructure/statistics-activity.repository.js";

export type CalendarComposition = {
  activity: DayActivity[];
  ranges: CalendarRanges;
  section: ReadingStatisticsCalendarSection;
};

export type CalendarRanges = {
  displayRange: ReadingStatisticsDateRange;
  metricRange: ReadingStatisticsDateRange;
};

@Injectable()
export class StatisticsCalendarComposer {
  constructor(
    private readonly activityRepository: StatisticsActivityRepository,
    private readonly mediaService: MediaService,
  ) {}

  async compose({
    period,
    reliableFrom,
    today,
    userId,
  }: {
    period: { from: Nullable<string>; to: string };
    reliableFrom: string;
    today: string;
    userId: string;
  }): Promise<CalendarComposition> {
    const ranges = await this.resolveRanges({ period, today, userId });
    if (ranges === null) {
      return {
        activity: [],
        ranges: {
          displayRange: { from: period.to, to: period.to },
          metricRange: { from: period.to, to: period.to },
        },
        section: unavailableCalendar(period.to),
      };
    }

    const [activity, previews, activeBeforeRange] = await Promise.all([
      this.activityRepository.aggregateDays({
        from: ranges.metricRange.from,
        to: ranges.metricRange.to,
        userId,
      }),
      this.activityRepository.findDayBookPreviews({
        from: ranges.displayRange.from,
        to: ranges.displayRange.to,
        userId,
      }),
      this.activityRepository.hasActivityBefore({ date: ranges.metricRange.from, userId }),
    ]);

    const activeDays = toActiveDays(activity);
    const metricReliable = isRangeFullyReliable({ from: ranges.metricRange.from, reliableFrom });

    return {
      activity,
      ranges,
      section: {
        activeDays: activeDays.length,
        activeDaysPercentage: {
          availability: metricReliable ? "available" : "partial",
          value: activeDays.length / countEligibleDays(ranges.metricRange),
        },
        availability: metricReliable ? "available" : "partial",
        currentStreak: resolveCurrentStreak({
          activeBeforeRange,
          activeDays,
          metricRange: ranges.metricRange,
          reliableFrom,
          today,
        }),
        days: buildCalendarDays({
          activity,
          bookActivity: this.toBookActivity(previews),
          displayRange: ranges.displayRange,
          reliableFrom,
        }),
        displayRange: ranges.displayRange,
        longestStreak: findLongestStreak(activeDays),
        metricRange: ranges.metricRange,
        mostActiveWeekday: this.buildMostActiveWeekday({ activity, metricReliable }),
        weekdayActivity: {
          availability: metricReliable ? "available" : "partial",
          items: buildWeekdayActivity(activity),
        },
      },
    };
  }

  private buildMostActiveWeekday({
    activity,
    metricReliable,
  }: {
    activity: DayActivity[];
    metricReliable: boolean;
  }): StatisticsMostActiveWeekday {
    if (!metricReliable) {
      return { availability: "unavailable", data: null, reason: "LEGACY_HISTORY_INCOMPLETE" };
    }
    const weekday = findMostActiveWeekday(activity);
    return weekday === null
      ? { availability: "available", data: null }
      : { availability: "available", data: weekday };
  }

  private async resolveRanges({
    period,
    today,
    userId,
  }: {
    period: { from: Nullable<string>; to: string };
    today: string;
    userId: string;
  }): Promise<Nullable<CalendarRanges>> {
    if (period.from !== null) {
      const range = { from: period.from, to: period.to };
      return { displayRange: range, metricRange: range };
    }

    const earliest = await this.activityRepository.findEarliestActivityDate(userId);
    if (earliest === null) {
      return null;
    }

    const metricRange = { from: earliest, to: period.to };
    const windowStart = rollingYearStart(today);

    return {
      displayRange: {
        from: windowStart > earliest ? windowStart : earliest,
        to: period.to,
      },
      metricRange,
    };
  }

  private toBookActivity(previews: DayBookWithPresentation[]): DayBookActivity[] {
    return previews.map((preview) => ({
      bookId: preview.bookId,
      coverThumbUrl: this.mediaService.buildThumbUrlOrNull(preview.coverMedia),
      date: preview.date,
      pagesRead: preview.pagesRead,
      title: preview.title,
    }));
  }
}

function unavailableCalendar(today: string): ReadingStatisticsCalendarSection {
  const range = { from: today, to: today };
  return {
    activeDays: 0,
    activeDaysPercentage: { availability: "unavailable", value: null },
    availability: "unavailable",
    currentStreak: { availability: "unavailable", data: null, reason: "LEGACY_HISTORY_INCOMPLETE" },
    days: [],
    displayRange: range,
    longestStreak: { days: 0, endDate: null, startDate: null },
    metricRange: range,
    mostActiveWeekday: { availability: "unavailable", data: null },
    reason: "NO_ACTIVITY_HISTORY",
    weekdayActivity: { availability: "unavailable", items: [] },
  };
}
