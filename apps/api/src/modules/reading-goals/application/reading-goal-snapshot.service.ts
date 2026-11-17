import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { isEqual } from "date-fns";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { ReadingGoalQualificationWindow } from "../domain/reading-goal-window.js";
import type { ReadingGoalSnapshotBookInput } from "../infrastructure/reading-goal-books.repository.js";
import type { ReadingGoalWithList } from "../infrastructure/reading-goals.repository.js";

import { qualifiesForReadingGoal } from "../domain/reading-goal-progress.js";
import { resolveReadingGoalQualificationWindow } from "../domain/reading-goal-window.js";
import { ReadingGoalBooksRepository } from "../infrastructure/reading-goal-books.repository.js";
import { toReadingGoalCalculationGoal } from "./reading-goal-calendar.js";

export type ReadingGoalQualificationChange = {
  bookId: string;
  previousQualifiedFinishedAt: Nullable<Date>;
  qualifiedFinishedAt: Nullable<Date>;
};

export type ReadingGoalSnapshotCandidate = {
  bookId: string;
  position: number;
};

type ResyncInput = {
  goal: ReadingGoalWithList;
  timeZone: string;
  tx: Prisma.TransactionClient;
};

type SeedInput = ResyncInput & {
  candidates: ReadingGoalSnapshotCandidate[];
};

@Injectable()
export class ReadingGoalSnapshotService {
  constructor(private readonly readingGoalBooksRepository: ReadingGoalBooksRepository) {}

  async resync({ goal, timeZone, tx }: ResyncInput): Promise<ReadingGoalQualificationChange[]> {
    const rows = await this.readingGoalBooksRepository.findSnapshotProgress(
      { goalId: goal.id, timeZone },
      tx,
    );
    const window = resolveReadingGoalQualificationWindow(
      toReadingGoalCalculationGoal({ goal, timeZone }),
    );
    const changes: ReadingGoalQualificationChange[] = [];

    for (const row of rows) {
      const qualifiedFinishedAt = resolveQualifiedFinishedAt({
        ...window,
        finishedAt: row.finishedAt,
      });
      const qualifiedReadingCycleId = qualifiedFinishedAt === null ? null : row.readingCycleId;
      if (
        isSameQualification(row.qualifiedFinishedAt, qualifiedFinishedAt) &&
        row.qualifiedReadingCycleId === qualifiedReadingCycleId
      ) {
        continue;
      }
      const written = await this.readingGoalBooksRepository.updateQualifiedFinishedAt(
        {
          bookId: row.bookId,
          goalId: goal.id,
          previousQualifiedFinishedAt: row.qualifiedFinishedAt,
          qualifiedFinishedAt,
          qualifiedReadingCycleId,
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

  async seed({ candidates, goal, timeZone, tx }: SeedInput): Promise<void> {
    if (candidates.length === 0) {
      return;
    }
    const rows: ReadingGoalSnapshotBookInput[] = candidates.map((candidate) => ({
      bookId: candidate.bookId,
      position: candidate.position,
    }));
    await this.readingGoalBooksRepository.createMany({ goalId: goal.id, rows }, tx);
    await this.resync({ goal, timeZone, tx });
  }
}

function isSameQualification(left: Nullable<Date>, right: Nullable<Date>): boolean {
  if (left === null || right === null) {
    return left === right;
  }
  return isEqual(left, right);
}

function resolveQualifiedFinishedAt({
  countingEndsAt,
  finishedAt,
  goalStartDate,
}: ReadingGoalQualificationWindow & { finishedAt: Nullable<Date> }): Nullable<Date> {
  return qualifiesForReadingGoal({ countingEndsAt, finishedAt, goalStartDate }) ? finishedAt : null;
}
