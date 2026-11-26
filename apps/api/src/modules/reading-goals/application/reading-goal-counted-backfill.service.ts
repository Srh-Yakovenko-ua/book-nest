import { defaultUserProfileSettings } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  ReadingGoalCountedOrdinalReplay,
  ReadingGoalCountedReplay,
  ReadingGoalCountedReplaySkip,
} from "../domain/reading-goal-counted-replay.js";
import type { ReadingGoalCountedBackfillCandidate } from "../infrastructure/reading-goals.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { ConflictError } from "../../../core/exceptions/errors.js";
import { toZonedCalendarDay } from "../../../core/iso-date.js";
import { scanByKeyset } from "../../../core/keyset-scan.js";
import { replayReadingGoalCountedOrdinals } from "../domain/reading-goal-counted-replay.js";
import { calculateReadingGoalMetrics } from "../domain/reading-goal-metrics.js";
import { READING_GOAL_MESSAGE } from "../domain/reading-goal.constants.js";
import { ReadingGoalActivityRepository } from "../infrastructure/reading-goal-activity.repository.js";
import { ReadingGoalBooksRepository } from "../infrastructure/reading-goal-books.repository.js";
import { ReadingGoalsRepository } from "../infrastructure/reading-goals.repository.js";
import { toReadingGoalCalculationGoal } from "./reading-goal-calendar.js";

export type ReadingGoalCountedBackfillMode = "apply" | "dry_run";

export type ReadingGoalCountedBackfillOutcome =
  | {
      changes: ReadingGoalCountedOrdinalReplay[];
      goalId: string;
      status: "applied" | "planned";
    }
  | { goalId: string; skip: ReadingGoalCountedBackfillSkip; status: "skipped" }
  | { goalId: string; status: "unchanged" };

type GoalReplayInput = {
  client: Prisma.TransactionClient | undefined;
  goal: ReadingGoalCountedBackfillCandidate;
  now: Date;
};

type ReadingGoalCountedBackfillSkip =
  ReadingGoalCountedReplaySkip | { reason: "concurrent_change" };

const READING_GOAL_COUNTED_BACKFILL = {
  defaultTimeZone: defaultUserProfileSettings.timezone,
  maxPages: 1_000,
  pageSize: 100,
  scope: "reading-goals.counted-backfill",
} as const;

@Injectable()
export class ReadingGoalCountedBackfillService {
  constructor(
    private readonly readingGoalActivityRepository: ReadingGoalActivityRepository,
    private readonly readingGoalBooksRepository: ReadingGoalBooksRepository,
    private readonly readingGoalsRepository: ReadingGoalsRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async run({
    mode,
    now,
  }: {
    mode: ReadingGoalCountedBackfillMode;
    now: Date;
  }): Promise<ReadingGoalCountedBackfillOutcome[]> {
    const outcomes: ReadingGoalCountedBackfillOutcome[] = [];
    await scanByKeyset<ReadingGoalCountedBackfillCandidate>({
      loadPage: (afterId) =>
        this.readingGoalsRepository.findCountedBackfillCandidates({
          afterId,
          limit: READING_GOAL_COUNTED_BACKFILL.pageSize,
        }),
      maxPages: READING_GOAL_COUNTED_BACKFILL.maxPages,
      pageSize: READING_GOAL_COUNTED_BACKFILL.pageSize,
      scope: READING_GOAL_COUNTED_BACKFILL.scope,
      toCursor: (goal) => goal.id,
      visitPage: async (goals) => {
        for (const goal of goals) {
          outcomes.push(await this.reconcileGoal({ goal, mode, now }));
        }
      },
    });
    return outcomes;
  }

  private async applyGoal({
    goal,
    now,
    tx,
  }: {
    goal: ReadingGoalCountedBackfillCandidate;
    now: Date;
    tx: Prisma.TransactionClient;
  }): Promise<ReadingGoalCountedBackfillOutcome> {
    const plan = await this.planGoal({ client: tx, goal, now });
    if (plan.status !== "planned") {
      return plan;
    }
    for (const change of plan.changes) {
      const written = await this.readingGoalActivityRepository.rewriteBookCountedOrdinal(
        change,
        tx,
      );
      if (written === 0) {
        throw new ConflictError(READING_GOAL_MESSAGE.countedBackfillConcurrentChange);
      }
    }
    return { ...plan, status: "applied" };
  }

  private async planGoal({
    client,
    goal,
    now,
  }: GoalReplayInput): Promise<ReadingGoalCountedBackfillOutcome> {
    const replay = await this.replayGoal({ client, goal, now });
    if (replay.status === "skipped") {
      return { goalId: goal.id, skip: replay.skip, status: "skipped" };
    }
    const changes = changedOrdinals(replay.ordinals);
    return changes.length === 0
      ? { goalId: goal.id, status: "unchanged" }
      : { changes, goalId: goal.id, status: "planned" };
  }

  private async reconcileGoal({
    goal,
    mode,
    now,
  }: Omit<GoalReplayInput, "client"> & {
    mode: ReadingGoalCountedBackfillMode;
  }): Promise<ReadingGoalCountedBackfillOutcome> {
    if (mode === "dry_run") {
      return this.planGoal({ client: undefined, goal, now });
    }
    try {
      return await this.transactionRunner.run((tx) => this.applyGoal({ goal, now, tx }));
    } catch (error) {
      if (error instanceof ConflictError) {
        return { goalId: goal.id, skip: { reason: "concurrent_change" }, status: "skipped" };
      }
      throw error;
    }
  }

  private async replayGoal({
    client,
    goal,
    now,
  }: GoalReplayInput): Promise<ReadingGoalCountedReplay> {
    const timeZone = goal.timezone ?? READING_GOAL_COUNTED_BACKFILL.defaultTimeZone;
    const activities = await this.readingGoalActivityRepository.findAllForGoal(
      { goalId: goal.id },
      client,
    );
    const snapshotBooks = await this.readingGoalBooksRepository.findByGoal(
      { goalId: goal.id },
      client,
    );
    const { progress } = calculateReadingGoalMetrics({
      goal: toReadingGoalCalculationGoal({ goal, timeZone }),
      snapshotBooks,
      today: toZonedCalendarDay({ instant: now, timeZone }),
    });
    return replayReadingGoalCountedOrdinals({
      activities,
      countedTotal: progress.completedCount,
    });
  }
}

function changedOrdinals(
  ordinals: readonly ReadingGoalCountedOrdinalReplay[],
): ReadingGoalCountedOrdinalReplay[] {
  return ordinals.filter((ordinal) => ordinal.completedCount !== ordinal.recordedCompletedCount);
}
