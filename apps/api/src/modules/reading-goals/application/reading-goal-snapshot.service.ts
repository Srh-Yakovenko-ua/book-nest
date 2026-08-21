import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { isEqual } from "date-fns";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { ReadingGoalSnapshotBookInput } from "../infrastructure/reading-goal-books.repository.js";
import type { ReadingGoalWithList } from "../infrastructure/reading-goals.repository.js";

import { startOfUtcDay } from "../../../core/iso-date.js";
import { qualifiesForReadingGoal } from "../domain/reading-goal-progress.js";
import { resolveReadingGoalCountingEnd } from "../domain/reading-goal-window.js";
import { ReadingGoalBooksRepository } from "../infrastructure/reading-goal-books.repository.js";

export type ReadingGoalQualificationChange = {
  bookId: string;
  previousQualifiedFinishedAt: Nullable<Date>;
  qualifiedFinishedAt: Nullable<Date>;
};

export type ReadingGoalSnapshotCandidate = {
  bookId: string;
  finishedAt: Nullable<Date>;
  position: number;
};

type QualificationWindow = {
  countingEndsAt: Date;
  goalStartDate: Date;
};

type ResyncInput = {
  goal: ReadingGoalWithList;
  tx: Prisma.TransactionClient;
};

type SeedInput = {
  candidates: ReadingGoalSnapshotCandidate[];
  goal: ReadingGoalWithList;
  tx: Prisma.TransactionClient;
};

@Injectable()
export class ReadingGoalSnapshotService {
  constructor(private readonly readingGoalBooksRepository: ReadingGoalBooksRepository) {}

  async resync({ goal, tx }: ResyncInput): Promise<ReadingGoalQualificationChange[]> {
    const rows = await this.readingGoalBooksRepository.findSnapshotProgress(
      { goalId: goal.id },
      tx,
    );
    const window = qualificationWindow(goal);
    const changes: ReadingGoalQualificationChange[] = [];

    for (const row of rows) {
      const qualifiedFinishedAt = resolveQualifiedFinishedAt({
        ...window,
        finishedAt: row.finishedAt,
      });
      if (isSameQualification(row.qualifiedFinishedAt, qualifiedFinishedAt)) {
        continue;
      }
      const written = await this.readingGoalBooksRepository.updateQualifiedFinishedAt(
        {
          bookId: row.bookId,
          goalId: goal.id,
          previousQualifiedFinishedAt: row.qualifiedFinishedAt,
          qualifiedFinishedAt,
        },
        tx,
      );
      if (written === 1) {
        changes.push({
          bookId: row.bookId,
          previousQualifiedFinishedAt: row.qualifiedFinishedAt,
          qualifiedFinishedAt,
        });
      }
    }

    return changes;
  }

  async seed({ candidates, goal, tx }: SeedInput): Promise<void> {
    if (candidates.length === 0) {
      return;
    }
    const window = qualificationWindow(goal);
    const rows: ReadingGoalSnapshotBookInput[] = candidates.map((candidate) => ({
      bookId: candidate.bookId,
      position: candidate.position,
      qualifiedFinishedAt: resolveQualifiedFinishedAt({
        ...window,
        finishedAt: candidate.finishedAt,
      }),
    }));
    await this.readingGoalBooksRepository.createMany({ goalId: goal.id, rows }, tx);
  }
}

function isSameQualification(left: Nullable<Date>, right: Nullable<Date>): boolean {
  if (left === null || right === null) {
    return left === right;
  }
  return isEqual(left, right);
}

function qualificationWindow({
  archivedAt,
  createdAt,
  deadline,
}: ReadingGoalWithList): QualificationWindow {
  return {
    countingEndsAt: resolveReadingGoalCountingEnd({ archivedAt, deadline }),
    goalStartDate: startOfUtcDay(createdAt),
  };
}

function resolveQualifiedFinishedAt({
  countingEndsAt,
  finishedAt,
  goalStartDate,
}: QualificationWindow & { finishedAt: Nullable<Date> }): Nullable<Date> {
  return qualifiesForReadingGoal({ countingEndsAt, finishedAt, goalStartDate }) ? finishedAt : null;
}
