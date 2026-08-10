import type { ReadingGoalView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { ReadingGoalWithList } from "../infrastructure/reading-goals.repository.js";

import { startOfUtcDay } from "../../../core/iso-date.js";
import { calculateReadingGoalProgress } from "../domain/reading-goal-progress.js";
import { toReadingGoalView } from "../domain/reading-goal.mapper.js";
import { ReadingGoalsRepository } from "../infrastructure/reading-goals.repository.js";

@Injectable()
export class ReadingGoalViewBuilder {
  constructor(private readonly readingGoalsRepository: ReadingGoalsRepository) {}

  async build({
    client,
    goal,
    now,
  }: {
    client?: Prisma.TransactionClient;
    goal: ReadingGoalWithList;
    now: Date;
  }): Promise<ReadingGoalView> {
    const finishedDates = await this.countedFinishedDates(goal, client);
    return toReadingGoalView({
      goal,
      progress: calculateReadingGoalProgress({
        archivedAt: goal.archivedAt,
        deadline: goal.deadline,
        finishedDates,
        now,
        targetCount: goal.targetCount,
      }),
    });
  }

  countedSince(goal: ReadingGoalWithList): Date {
    return startOfUtcDay(goal.createdAt);
  }

  private countedFinishedDates(
    goal: ReadingGoalWithList,
    client?: Prisma.TransactionClient,
  ): Promise<Date[]> {
    if (goal.listId === null) {
      return Promise.resolve([]);
    }
    return this.readingGoalsRepository.findCountedFinishedDates(
      {
        listId: goal.listId,
        since: this.countedSince(goal),
        userId: goal.userId,
      },
      client,
    );
  }
}
