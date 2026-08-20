import type { Nullable, ReadingGoalRiskLevel } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { ReadingGoalBooksRepository } from "../infrastructure/reading-goal-books.repository.js";
import { ReadingGoalsRepository } from "../infrastructure/reading-goals.repository.js";
import { ReadingGoalViewBuilder } from "./reading-goal-view.builder.js";

export type ActiveReadingGoalMembership = {
  bookId: string;
  goalId: string;
  goalName: Nullable<string>;
  riskLevel: ReadingGoalRiskLevel;
};

@Injectable()
export class ReadingGoalPlansService {
  constructor(
    private readonly readingGoalBooksRepository: ReadingGoalBooksRepository,
    private readonly readingGoalsRepository: ReadingGoalsRepository,
    private readonly viewBuilder: ReadingGoalViewBuilder,
  ) {}

  async listActiveMemberships({
    bookIds,
    userId,
  }: {
    bookIds: string[];
    userId: string;
  }): Promise<ActiveReadingGoalMembership[]> {
    if (bookIds.length === 0) {
      return [];
    }

    const entries = await this.readingGoalBooksRepository.findSnapshotEntriesForBooks({
      bookIds,
      userId,
    });
    const uncounted = entries.filter((entry) => entry.qualifiedFinishedAt === null);
    if (uncounted.length === 0) {
      return [];
    }

    const goals = await this.readingGoalsRepository.findOwnedByIds({
      goalIds: [...new Set(uncounted.map((entry) => entry.goalId))],
      userId,
    });
    const calculated = await this.viewBuilder.calculateAll({ goals, now: new Date() });
    const activeGoals = new Map(
      calculated
        .filter((entry) => entry.calculation.progress.status === "active")
        .map((entry) => [
          entry.goal.id,
          { name: entry.goal.name, riskLevel: entry.calculation.metrics.riskLevel },
        ]),
    );

    return uncounted.flatMap((entry) => {
      const goal = activeGoals.get(entry.goalId);
      if (goal === undefined) {
        return [];
      }
      return [
        {
          bookId: entry.bookId,
          goalId: entry.goalId,
          goalName: goal.name,
          riskLevel: goal.riskLevel,
        },
      ];
    });
  }
}
