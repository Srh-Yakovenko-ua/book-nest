import type {
  Nullable,
  ReadingGoalMetrics,
  ReadingGoalRiskLevel,
  ReadingGoalStatus,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import { UserSettingsContextService } from "../../profile/index.js";
import { ReadingGoalBooksRepository } from "../infrastructure/reading-goal-books.repository.js";
import { ReadingGoalsRepository } from "../infrastructure/reading-goals.repository.js";
import {
  type ReadingGoalCalculationEntry,
  ReadingGoalViewBuilder,
} from "./reading-goal-view.builder.js";

export type ActiveReadingGoalMembership = {
  bookId: string;
  goalId: string;
  goalName: Nullable<string>;
  riskLevel: ReadingGoalRiskLevel;
};

export type ActiveReadingGoalSnapshot = {
  createdAt: Date;
  deadline: Date;
  goalId: string;
  listName: Nullable<string>;
  metrics: ReadingGoalMetrics;
  name: Nullable<string>;
  status: ReadingGoalStatus;
  targetCount: number;
};

export type CompletedReadingGoalSnapshot = {
  completedAt: Date;
  goalId: string;
  listName: Nullable<string>;
  name: Nullable<string>;
  targetCount: number;
};

export type ReadingGoalPlans = {
  active: ActiveReadingGoalSnapshot[];
  completed: CompletedReadingGoalSnapshot[];
};

@Injectable()
export class ReadingGoalPlansService {
  constructor(
    private readonly readingGoalBooksRepository: ReadingGoalBooksRepository,
    private readonly readingGoalsRepository: ReadingGoalsRepository,
    private readonly viewBuilder: ReadingGoalViewBuilder,
    private readonly userSettingsContextService: UserSettingsContextService,
  ) {}

  async listActiveGoals(userId: string): Promise<ActiveReadingGoalSnapshot[]> {
    const goals = await this.readingGoalsRepository.findOpenGoals({ userId });
    if (goals.length === 0) {
      return [];
    }

    const { timeZone, today } = await this.userSettingsContextService.calendar({
      now: new Date(),
      userId,
    });
    const calculated = await this.viewBuilder.calculateAll({ goals, timeZone, today });
    return calculated.flatMap(toActiveSnapshot);
  }

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

    const { timeZone, today } = await this.userSettingsContextService.calendar({
      now: new Date(),
      userId,
    });
    const entries = await this.readingGoalBooksRepository.findSnapshotEntriesForBooks({
      bookIds,
      timeZone,
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
    const calculated = await this.viewBuilder.calculateAll({ goals, timeZone, today });
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

  async listGoalPlans({
    timeZone,
    today,
    userId,
  }: {
    timeZone: string;
    today: Date;
    userId: string;
  }): Promise<ReadingGoalPlans> {
    const goals = await this.readingGoalsRepository.findOpenGoals({ userId });
    if (goals.length === 0) {
      return { active: [], completed: [] };
    }

    const calculated = await this.viewBuilder.calculateAll({ goals, timeZone, today });
    return {
      active: calculated.flatMap(toActiveSnapshot),
      completed: calculated.flatMap(toCompletedSnapshot),
    };
  }
}

function toActiveSnapshot(entry: ReadingGoalCalculationEntry): ActiveReadingGoalSnapshot[] {
  if (entry.calculation.progress.status !== "active") {
    return [];
  }
  return [
    {
      createdAt: entry.goal.createdAt,
      deadline: entry.goal.deadline,
      goalId: entry.goal.id,
      listName: entry.goal.list?.name ?? null,
      metrics: entry.calculation.metrics,
      name: entry.goal.name,
      status: entry.calculation.progress.status,
      targetCount: entry.goal.targetCount,
    },
  ];
}

function toCompletedSnapshot(entry: ReadingGoalCalculationEntry): CompletedReadingGoalSnapshot[] {
  const { completedAt, status } = entry.calculation.progress;
  if (status !== "completed" || completedAt === null) {
    return [];
  }
  return [
    {
      completedAt,
      goalId: entry.goal.id,
      listName: entry.goal.list?.name ?? null,
      name: entry.goal.name,
      targetCount: entry.goal.targetCount,
    },
  ];
}
