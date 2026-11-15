import { defaultUserProfileSettings } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import type { ExclusiveTask } from "../../../core/exclusive-task.js";
import type { ReadingGoalProgress } from "../domain/reading-goal-progress.js";
import type { ReadingGoalActivityInput } from "../infrastructure/reading-goal-activity.repository.js";
import type { ReadingGoalExpirationCandidate } from "../infrastructure/reading-goals.repository.js";

import { createExclusiveTask } from "../../../core/exclusive-task.js";
import { addDaysToUtcDay, toIsoDate, toZonedCalendarDay } from "../../../core/iso-date.js";
import { scanByKeyset } from "../../../core/keyset-scan.js";
import { createLogger } from "../../../core/logger.js";
import { calculateReadingGoalMetrics } from "../domain/reading-goal-metrics.js";
import { hasDeadlinePassed } from "../domain/reading-goal-progress.js";
import { ReadingGoalActivityRepository } from "../infrastructure/reading-goal-activity.repository.js";
import { ReadingGoalBooksRepository } from "../infrastructure/reading-goal-books.repository.js";
import { ReadingGoalsRepository } from "../infrastructure/reading-goals.repository.js";
import { toReadingGoalCalculationGoal } from "./reading-goal-calendar.js";

const READING_GOAL_EXPIRATION_SWEEP = {
  candidatePageSize: 100,
  defaultTimeZone: defaultUserProfileSettings.timezone,
  maxCandidatePages: 50,
  maxLocalDaysAheadOfUtc: 1,
} as const;

const SWEEP_SCOPE = "reading-goals.expiration-reconciler";

const log = createLogger(SWEEP_SCOPE);

@Injectable()
export class ReadingGoalExpirationReconciler {
  private readonly runExclusively: ExclusiveTask;

  constructor(
    private readonly readingGoalActivityRepository: ReadingGoalActivityRepository,
    private readonly readingGoalBooksRepository: ReadingGoalBooksRepository,
    private readonly readingGoalsRepository: ReadingGoalsRepository,
  ) {
    this.runExclusively = createExclusiveTask({ run: () => this.runSafely(), scope: SWEEP_SCOPE });
  }

  async run({ now }: { now: Date }): Promise<void> {
    let expiredCount = 0;
    const deadlineBefore = addDaysToUtcDay({
      day: now,
      days: READING_GOAL_EXPIRATION_SWEEP.maxLocalDaysAheadOfUtc,
    });

    const summary = await scanByKeyset<ReadingGoalExpirationCandidate>({
      loadPage: (afterId) =>
        this.readingGoalsRepository.findExpirationCandidates({
          afterId,
          deadlineBefore,
          limit: READING_GOAL_EXPIRATION_SWEEP.candidatePageSize,
        }),
      maxPages: READING_GOAL_EXPIRATION_SWEEP.maxCandidatePages,
      pageSize: READING_GOAL_EXPIRATION_SWEEP.candidatePageSize,
      scope: SWEEP_SCOPE,
      toCursor: (goal) => goal.id,
      visitPage: async (goals) => {
        for (const goal of goals) {
          const expired = await this.expireGoal({ goal, now });
          if (expired) {
            expiredCount += 1;
          }
        }
      },
    });

    if (expiredCount > 0) {
      log.info({ expiredCount, visited: summary.visited }, "recorded expired reading goals");
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  sweep(): Promise<void> {
    return this.runExclusively();
  }

  private async expireGoal({
    goal,
    now,
  }: {
    goal: ReadingGoalExpirationCandidate;
    now: Date;
  }): Promise<boolean> {
    try {
      const timeZone = goal.timezone ?? READING_GOAL_EXPIRATION_SWEEP.defaultTimeZone;
      const today = toZonedCalendarDay({ instant: now, timeZone });
      if (!hasDeadlinePassed({ deadline: goal.deadline, reference: today })) {
        return false;
      }

      const snapshotBooks = await this.readingGoalBooksRepository.findByGoal({ goalId: goal.id });
      const { progress } = calculateReadingGoalMetrics({
        goal: toReadingGoalCalculationGoal({ goal, timeZone }),
        snapshotBooks,
        today,
      });
      if (progress.status !== "expired") {
        return false;
      }

      const recorded = await this.readingGoalActivityRepository.existsOfType({
        goalId: goal.id,
        type: "goal_expired",
      });
      if (recorded) {
        return false;
      }

      await this.readingGoalActivityRepository.createMany({
        rows: [expiredRow({ goal, progress })],
      });
      return true;
    } catch (error) {
      log.error({ err: error, goalId: goal.id }, "expiration reconciliation failed for a goal");
      return false;
    }
  }

  private async runSafely(): Promise<void> {
    try {
      await this.run({ now: new Date() });
    } catch (error) {
      log.error({ err: error }, "expiration reconciliation failed to scan goals");
    }
  }
}

function expiredRow({
  goal,
  progress,
}: {
  goal: ReadingGoalExpirationCandidate;
  progress: ReadingGoalProgress;
}): ReadingGoalActivityInput {
  return {
    bookId: null,
    goalId: goal.id,
    metadata: {
      completedCount: progress.completedCount,
      deadline: toIsoDate(goal.deadline),
      remainingCount: progress.remainingCount,
      targetCount: goal.targetCount,
    },
    type: "goal_expired",
    userId: goal.userId,
  };
}
