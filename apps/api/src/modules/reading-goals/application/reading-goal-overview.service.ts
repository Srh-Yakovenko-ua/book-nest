import type {
  Nullable,
  ReadingGoalBestResult,
  ReadingGoalListItem,
  ReadingGoalsOverview,
} from "@app/shared";

import { Injectable } from "@nestjs/common";
import { formatInTimeZone } from "date-fns-tz";

import { daysBetweenIsoDates } from "../../../core/iso-date.js";
import { createLogger } from "../../../core/logger.js";
import {
  buildReadingGoalAttention,
  needsReadingGoalAttention,
} from "../domain/reading-goal-attention.js";
import {
  READING_GOAL_LIMITS,
  READING_GOAL_ROUNDING,
  roundTo,
} from "../domain/reading-goal.constants.js";
import { toReadingGoalListItem } from "../domain/reading-goal.mapper.js";
import { ReadingGoalsRepository } from "../infrastructure/reading-goals.repository.js";
import { ReadingGoalViewBuilder } from "./reading-goal-view.builder.js";

const UTC_TIME_ZONE = "UTC";
const YEAR_FORMAT = "yyyy";
const PERCENT_SCALE = 100;

const log = createLogger("reading-goals.overview");

type BestResultCandidate = {
  daysBeforeDeadline: number;
  item: ReadingGoalListItem;
};

@Injectable()
export class ReadingGoalOverviewService {
  constructor(
    private readonly readingGoalsRepository: ReadingGoalsRepository,
    private readonly viewBuilder: ReadingGoalViewBuilder,
  ) {}

  async overview({ userId }: { userId: string }): Promise<ReadingGoalsOverview> {
    const now = new Date();
    const scanned = await this.readingGoalsRepository.findCatalogPage({
      limit: READING_GOAL_LIMITS.catalogScan + 1,
      listId: null,
      sort: "created_desc",
      userId,
    });
    if (scanned.length > READING_GOAL_LIMITS.catalogScan) {
      log.warn(
        { cap: READING_GOAL_LIMITS.catalogScan, userId },
        "goal overview truncated at the scan cap",
      );
    }

    const entries = await this.viewBuilder.calculateAll({
      goals: scanned.slice(0, READING_GOAL_LIMITS.catalogScan),
      now,
    });
    const items = entries.map((entry) => toReadingGoalListItem(entry));
    const currentYear = formatInTimeZone(now, UTC_TIME_ZONE, YEAR_FORMAT);
    const booksCounted = await this.readingGoalsRepository.countBooksQualifiedBetween({
      from: `${currentYear}-01-01`,
      to: `${Number(currentYear) + 1}-01-01`,
      userId,
    });

    const attentionItems = items.filter((item) => needsReadingGoalAttention(item));
    const completed = items.filter((item) => item.result === "completed");
    const finished = items.filter((item) => item.result !== null);

    return {
      active: {
        needsAttention: attentionItems.length,
        onTrack: items.filter((item) => isOnTrack(item)).length,
        total: items.filter((item) => item.status === "active").length,
      },
      attention: buildReadingGoalAttention(attentionItems),
      bestResult: selectBestResult(completed),
      booksCounted: { currentYear: booksCounted },
      completed: {
        completedOnOrBeforeDeadline: completed.filter((item) => daysBeforeDeadline(item) >= 0)
          .length,
        total: completed.length,
      },
      success: {
        finishedGoals: finished.length,
        successfulGoals: completed.length,
        successRatePercent: successRatePercent({
          finishedGoals: finished.length,
          successfulGoals: completed.length,
        }),
      },
    };
  }
}

function compareBestResults(left: BestResultCandidate, right: BestResultCandidate): number {
  const byDays = right.daysBeforeDeadline - left.daysBeforeDeadline;
  return byDays === 0 ? left.item.id.localeCompare(right.item.id) : byDays;
}

function daysBeforeDeadline({ completedAt, deadline }: ReadingGoalListItem): number {
  if (completedAt === null) {
    return -1;
  }
  return daysBetweenIsoDates({ endIsoDate: deadline, startIsoDate: completedAt });
}

function isOnTrack(item: ReadingGoalListItem): boolean {
  if (item.status !== "active" || needsReadingGoalAttention(item)) {
    return false;
  }
  return item.pace === "ahead" || item.pace === "on_track";
}

function selectBestResult(completed: ReadingGoalListItem[]): Nullable<ReadingGoalBestResult> {
  const best = completed
    .map((item) => ({ daysBeforeDeadline: daysBeforeDeadline(item), item }))
    .filter((candidate) => candidate.daysBeforeDeadline >= 0)
    .sort(compareBestResults)
    .at(0);
  if (best === undefined || best.item.completedAt === null) {
    return null;
  }
  return {
    completedAt: best.item.completedAt,
    daysBeforeDeadline: best.daysBeforeDeadline,
    goalId: best.item.id,
    goalName: best.item.name,
    listName: best.item.list?.name ?? null,
    targetCount: best.item.targetCount,
  };
}

function successRatePercent({
  finishedGoals,
  successfulGoals,
}: {
  finishedGoals: number;
  successfulGoals: number;
}): number {
  if (finishedGoals === 0) {
    return 0;
  }
  return roundTo({
    decimals: READING_GOAL_ROUNDING.successRate,
    value: (successfulGoals / finishedGoals) * PERCENT_SCALE,
  });
}
