import type { ReadingGoalListItem, ReadingGoalView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  ReadingGoalCalculation,
  ReadingGoalSnapshotBook,
} from "../domain/reading-goal-metrics.js";
import type { ReadingGoalSnapshotProgressRow } from "../infrastructure/reading-goal-books.repository.js";
import type { ReadingGoalWithList } from "../infrastructure/reading-goals.repository.js";

import { calculateReadingGoalMetrics } from "../domain/reading-goal-metrics.js";
import { toReadingGoalListItem, toReadingGoalView } from "../domain/reading-goal.mapper.js";
import { ReadingGoalBooksRepository } from "../infrastructure/reading-goal-books.repository.js";

export type ReadingGoalCalculationEntry = {
  calculation: ReadingGoalCalculation;
  goal: ReadingGoalWithList;
};

export type ReadingGoalSnapshotCalculation = {
  calculation: ReadingGoalCalculation;
  snapshot: ReadingGoalSnapshotProgressRow[];
};

type BuildInput = {
  client?: Prisma.TransactionClient;
  goal: ReadingGoalWithList;
  now: Date;
};

@Injectable()
export class ReadingGoalViewBuilder {
  constructor(private readonly readingGoalBooksRepository: ReadingGoalBooksRepository) {}

  async build({ client, goal, now }: BuildInput): Promise<ReadingGoalView> {
    const { calculation } = await this.calculate({ client, goal, now });
    return toReadingGoalView({ goal, progress: calculation.progress });
  }

  async buildListItem({ client, goal, now }: BuildInput): Promise<ReadingGoalListItem> {
    const { calculation } = await this.calculate({ client, goal, now });
    return toReadingGoalListItem({ calculation, goal });
  }

  buildListItemFrom({
    goal,
    now,
    snapshotBooks,
  }: {
    goal: ReadingGoalWithList;
    now: Date;
    snapshotBooks: ReadingGoalSnapshotBook[];
  }): ReadingGoalListItem {
    return toReadingGoalListItem({
      calculation: calculateReadingGoalMetrics({ goal, now, snapshotBooks }),
      goal,
    });
  }

  async calculate({ client, goal, now }: BuildInput): Promise<ReadingGoalSnapshotCalculation> {
    const snapshot = await this.readingGoalBooksRepository.findSnapshotProgress(
      { goalId: goal.id },
      client,
    );
    return {
      calculation: calculateReadingGoalMetrics({ goal, now, snapshotBooks: snapshot }),
      snapshot,
    };
  }

  async calculateAll({
    goals,
    now,
  }: {
    goals: ReadingGoalWithList[];
    now: Date;
  }): Promise<ReadingGoalCalculationEntry[]> {
    const rows = await this.readingGoalBooksRepository.findSnapshotQualifications({
      goalIds: goals.map((goal) => goal.id),
    });
    const snapshotsByGoal = new Map<string, ReadingGoalSnapshotBook[]>();
    for (const row of rows) {
      const snapshot = snapshotsByGoal.get(row.goalId) ?? [];
      snapshot.push({ bookId: row.bookId, qualifiedFinishedAt: row.qualifiedFinishedAt });
      snapshotsByGoal.set(row.goalId, snapshot);
    }
    return goals.map((goal) => ({
      calculation: calculateReadingGoalMetrics({
        goal,
        now,
        snapshotBooks: snapshotsByGoal.get(goal.id) ?? [],
      }),
      goal,
    }));
  }
}
