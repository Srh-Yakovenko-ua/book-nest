import type { Nullable, ReadingGoalUncountedReason } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  ReadingGoalCalculationGoal,
  ReadingGoalSnapshotBook,
} from "../domain/reading-goal-metrics.js";
import type {
  ReadingGoalProgress,
  ReadingGoalQualifyingBook,
} from "../domain/reading-goal-progress.js";
import type { ReadingGoalActivityInput } from "../infrastructure/reading-goal-activity.repository.js";
import type { ReadingGoalWithList } from "../infrastructure/reading-goals.repository.js";
import type { ReadingGoalQualificationChange } from "./reading-goal-snapshot.service.js";

import { daysBetweenUtcDays, toIsoDate, toNullableIsoDate } from "../../../core/iso-date.js";
import { assignReadingGoalCountedOrdinals } from "../domain/reading-goal-counted-ordinals.js";
import { calculateReadingGoalMetrics } from "../domain/reading-goal-metrics.js";
import { selectQualifyingReadingGoalBooks } from "../domain/reading-goal-progress.js";
import { resolveReadingGoalQualificationWindow } from "../domain/reading-goal-window.js";
import { ReadingGoalActivityRepository } from "../infrastructure/reading-goal-activity.repository.js";
import { ReadingGoalBooksRepository } from "../infrastructure/reading-goal-books.repository.js";
import { toReadingGoalCalculationGoal } from "./reading-goal-calendar.js";

type ArchiveActivityInput = GoalActivityInput & {
  changes: ReadingGoalQualificationChange[];
};

type GoalActivityInput = {
  goal: ReadingGoalWithList;
  timeZone: string;
  today: Date;
  tx: Prisma.TransactionClient;
};

type LifecycleInput = GoalActivityInput & {
  changes: ReadingGoalQualificationChange[];
  previous: ReadingGoalWithList;
  snapshotBooks: ReadingGoalSnapshotBook[];
};

type UpdateActivityInput = GoalActivityInput & {
  changes: ReadingGoalQualificationChange[];
  previous: ReadingGoalWithList;
};

@Injectable()
export class ReadingGoalActivityRecorder {
  constructor(
    private readonly readingGoalActivityRepository: ReadingGoalActivityRepository,
    private readonly readingGoalBooksRepository: ReadingGoalBooksRepository,
  ) {}

  async recordArchive({ changes, goal, timeZone, today, tx }: ArchiveActivityInput): Promise<void> {
    const snapshotBooks = await this.snapshotBooks({ goal, tx });
    const progress = progressOf({ goal, snapshotBooks, timeZone, today });
    await this.write({
      rows: [
        ...uncountedRows({ changes, goal, reason: "deadline_changed" }),
        activityRow({ goal, metadata: { result: progress.result }, type: "goal_archived" }),
      ],
      tx,
    });
  }

  async recordCreation({ goal, timeZone, today, tx }: GoalActivityInput): Promise<void> {
    const snapshotBooks = await this.snapshotBooks({ goal, tx });
    const calculationGoal = toReadingGoalCalculationGoal({ goal, timeZone });
    const { progress } = calculateReadingGoalMetrics({
      goal: calculationGoal,
      snapshotBooks,
      today,
    });
    const qualifying = qualifyingOrder({ goal: calculationGoal, snapshotBooks });
    await this.write({
      rows: [
        activityRow({
          goal,
          metadata: {
            deadline: toIsoDate(goal.deadline),
            snapshotBookCount: snapshotBooks.length,
            targetCount: goal.targetCount,
          },
          type: "goal_created",
        }),
        ...countedRows({
          countedBookIds: new Set(qualifying.map((book) => book.bookId)),
          goal,
          qualifying,
        }),
        ...(progress.status === "completed" ? [completedRow({ goal, progress })] : []),
      ],
      tx,
    });
  }

  async recordUpdate({
    changes,
    goal,
    previous,
    timeZone,
    today,
    tx,
  }: UpdateActivityInput): Promise<void> {
    const snapshotBooks = await this.snapshotBooks({ goal, tx });
    const qualifying = qualifyingOrder({
      goal: toReadingGoalCalculationGoal({ goal, timeZone }),
      snapshotBooks,
    });
    await this.write({
      rows: [
        ...fieldChangeRows({ goal, previous }),
        ...uncountedRows({ changes, goal, reason: "deadline_changed" }),
        ...countedRows({ countedBookIds: newlyCountedBookIds(changes), goal, qualifying }),
        ...(await this.lifecycleRows({
          changes,
          goal,
          previous,
          snapshotBooks,
          timeZone,
          today,
          tx,
        })),
      ],
      tx,
    });
  }

  private async lifecycleRows({
    changes,
    goal,
    previous,
    snapshotBooks,
    timeZone,
    today,
    tx,
  }: LifecycleInput): Promise<ReadingGoalActivityInput[]> {
    const after = progressOf({ goal, snapshotBooks, timeZone, today });
    const before = progressOf({
      goal: previous,
      snapshotBooks: previousSnapshotBooks({ changes, snapshotBooks }),
      timeZone,
      today,
    });
    if (after.status === before.status) {
      return [];
    }
    const row = lifecycleRow({ goal, progress: after });
    if (row === null) {
      return [];
    }
    const recorded = await this.readingGoalActivityRepository.existsOfType(
      { goalId: goal.id, type: row.type },
      tx,
    );
    return recorded ? [] : [row];
  }

  private snapshotBooks({
    goal,
    tx,
  }: {
    goal: ReadingGoalWithList;
    tx: Prisma.TransactionClient;
  }): Promise<ReadingGoalSnapshotBook[]> {
    return this.readingGoalBooksRepository.findByGoal({ goalId: goal.id }, tx);
  }

  private async write({
    rows,
    tx,
  }: {
    rows: ReadingGoalActivityInput[];
    tx: Prisma.TransactionClient;
  }): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    await this.readingGoalActivityRepository.createMany({ rows }, tx);
  }
}

function activityRow({
  bookId = null,
  goal,
  metadata,
  type,
}: {
  bookId?: Nullable<string>;
  goal: ReadingGoalWithList;
  metadata: Nullable<Prisma.InputJsonValue>;
  type: ReadingGoalActivityInput["type"];
}): ReadingGoalActivityInput {
  return { bookId, goalId: goal.id, metadata, type, userId: goal.userId };
}

function completedRow({
  goal,
  progress,
}: {
  goal: ReadingGoalWithList;
  progress: ReadingGoalProgress;
}): ReadingGoalActivityInput {
  const { completedAt } = progress;
  return activityRow({
    goal,
    metadata: {
      completedAt: toNullableIsoDate(completedAt),
      daysBeforeDeadline: completedAt === null ? null : daysBetween(goal.deadline, completedAt),
      targetCount: goal.targetCount,
    },
    type: "goal_completed",
  });
}

function countedRows({
  countedBookIds,
  goal,
  qualifying,
}: {
  countedBookIds: ReadonlySet<string>;
  goal: ReadingGoalWithList;
  qualifying: ReadingGoalQualifyingBook[];
}): ReadingGoalActivityInput[] {
  return assignReadingGoalCountedOrdinals({
    newlyCountedBookIds: countedBookIds,
    qualifyingBooks: qualifying,
  }).map((book) =>
    activityRow({
      bookId: book.bookId,
      goal,
      metadata: {
        completedCount: book.completedCount,
        finishedAt: toIsoDate(book.finishedAt),
        targetCount: goal.targetCount,
      },
      type: "book_counted",
    }),
  );
}

function daysBetween(deadline: Date, completedAt: Date): number {
  return Math.max(0, daysBetweenUtcDays({ end: deadline, start: completedAt }));
}

function expiredRow({
  goal,
  progress,
}: {
  goal: ReadingGoalWithList;
  progress: ReadingGoalProgress;
}): ReadingGoalActivityInput {
  return activityRow({
    goal,
    metadata: {
      completedCount: progress.completedCount,
      deadline: toIsoDate(goal.deadline),
      remainingCount: progress.remainingCount,
      targetCount: goal.targetCount,
    },
    type: "goal_expired",
  });
}

function fieldChangeRows({
  goal,
  previous,
}: {
  goal: ReadingGoalWithList;
  previous: ReadingGoalWithList;
}): ReadingGoalActivityInput[] {
  const rows: ReadingGoalActivityInput[] = [];
  if (previous.targetCount !== goal.targetCount) {
    rows.push(
      activityRow({
        goal,
        metadata: { from: previous.targetCount, to: goal.targetCount },
        type: "target_changed",
      }),
    );
  }
  const previousDeadline = toIsoDate(previous.deadline);
  const deadline = toIsoDate(goal.deadline);
  if (previousDeadline !== deadline) {
    rows.push(
      activityRow({
        goal,
        metadata: { from: previousDeadline, to: deadline },
        type: "deadline_changed",
      }),
    );
  }
  if (previous.name !== goal.name) {
    rows.push(
      activityRow({
        goal,
        metadata: { from: previous.name, to: goal.name },
        type: "goal_renamed",
      }),
    );
  }
  return rows;
}

function lifecycleRow({
  goal,
  progress,
}: {
  goal: ReadingGoalWithList;
  progress: ReadingGoalProgress;
}): Nullable<ReadingGoalActivityInput> {
  if (progress.status === "completed") {
    return completedRow({ goal, progress });
  }
  if (progress.status === "expired") {
    return expiredRow({ goal, progress });
  }
  return null;
}

function newlyCountedBookIds(changes: ReadingGoalQualificationChange[]): ReadonlySet<string> {
  return new Set(
    changes
      .filter(
        (change) =>
          change.previousQualifiedFinishedAt === null && change.qualifiedFinishedAt !== null,
      )
      .map((change) => change.bookId),
  );
}

function previousSnapshotBooks({
  changes,
  snapshotBooks,
}: {
  changes: ReadingGoalQualificationChange[];
  snapshotBooks: ReadingGoalSnapshotBook[];
}): ReadingGoalSnapshotBook[] {
  const previousByBookId = new Map(
    changes.map((change) => [change.bookId, change.previousQualifiedFinishedAt]),
  );
  return snapshotBooks.map((book) => {
    const previous = previousByBookId.get(book.bookId);
    return previous === undefined ? book : { bookId: book.bookId, qualifiedFinishedAt: previous };
  });
}

function progressOf({
  goal,
  snapshotBooks,
  timeZone,
  today,
}: {
  goal: ReadingGoalWithList;
  snapshotBooks: ReadingGoalSnapshotBook[];
  timeZone: string;
  today: Date;
}): ReadingGoalProgress {
  return calculateReadingGoalMetrics({
    goal: toReadingGoalCalculationGoal({ goal, timeZone }),
    snapshotBooks,
    today,
  }).progress;
}

function qualifyingOrder({
  goal,
  snapshotBooks,
}: {
  goal: ReadingGoalCalculationGoal;
  snapshotBooks: ReadingGoalSnapshotBook[];
}): ReadingGoalQualifyingBook[] {
  return selectQualifyingReadingGoalBooks({
    books: snapshotBooks.map((book) => ({
      bookId: book.bookId,
      finishedAt: book.qualifiedFinishedAt,
    })),
    ...resolveReadingGoalQualificationWindow(goal),
  });
}

function uncountedRows({
  changes,
  goal,
  reason,
}: {
  changes: ReadingGoalQualificationChange[];
  goal: ReadingGoalWithList;
  reason: ReadingGoalUncountedReason;
}): ReadingGoalActivityInput[] {
  return changes.flatMap((change) => {
    const { previousQualifiedFinishedAt } = change;
    if (previousQualifiedFinishedAt === null || change.qualifiedFinishedAt !== null) {
      return [];
    }
    return [
      activityRow({
        bookId: change.bookId,
        goal,
        metadata: {
          previousFinishedAt: toIsoDate(previousQualifiedFinishedAt),
          reason,
        },
        type: "book_uncounted",
      }),
    ];
  });
}
