import type { CreateReadingGoalInput, ReadingGoalView, UpdateReadingGoalInput } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { isEqual } from "date-fns";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { ReadingGoalWithList } from "../infrastructure/reading-goals.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { isUniqueConstraintErrorOn } from "../../../core/prisma-errors.js";
import { ListsService } from "../../lists/index.js";
import { ACTIVE_LIST_GOAL_INDEX, READING_GOAL_MESSAGE } from "../domain/reading-goal.constants.js";
import { ReadingGoalsRepository } from "../infrastructure/reading-goals.repository.js";
import { ReadingGoalActivityRecorder } from "./reading-goal-activity.recorder.js";
import { ReadingGoalInputValidator } from "./reading-goal-input.validator.js";
import { ReadingGoalSnapshotService } from "./reading-goal-snapshot.service.js";
import { ReadingGoalViewBuilder } from "./reading-goal-view.builder.js";

type CreateInput = {
  input: CreateReadingGoalInput;
  listId: string;
  userId: string;
};

type GoalCommand = {
  goalId: string;
  userId: string;
};

type UpdateInput = GoalCommand & {
  input: UpdateReadingGoalInput;
};

@Injectable()
export class ReadingGoalsService {
  constructor(
    private readonly readingGoalsRepository: ReadingGoalsRepository,
    private readonly listsService: ListsService,
    private readonly viewBuilder: ReadingGoalViewBuilder,
    private readonly transactionRunner: TransactionRunner,
    private readonly inputValidator: ReadingGoalInputValidator,
    private readonly snapshotService: ReadingGoalSnapshotService,
    private readonly activityRecorder: ReadingGoalActivityRecorder,
  ) {}

  async archive({ goalId, userId }: GoalCommand): Promise<ReadingGoalView> {
    const now = new Date();
    const goal = await this.findOwnedOrThrow({ goalId, userId });
    if (goal.archivedAt !== null) {
      return this.viewBuilder.build({ goal, now });
    }

    const archived = await this.transactionRunner.run(async (tx) => {
      const stamped = await this.readingGoalsRepository.archive(
        { archivedAt: now, goalId, userId },
        tx,
      );
      const current = await this.findOwnedOrThrow({ goalId, userId }, tx);
      if (stamped === 1) {
        const changes = await this.snapshotService.resync({ goal: current, tx });
        await this.activityRecorder.recordArchive({ changes, goal: current, now, tx });
      }
      return current;
    });

    return this.viewBuilder.build({ goal: archived, now });
  }

  async create({ input, listId, userId }: CreateInput): Promise<ReadingGoalView> {
    const now = new Date();
    await this.listsService.assertOwned({ listId, userId });
    const deadline = this.inputValidator.assertFutureDeadline({ deadline: input.deadline, now });

    const created = await this.transactionRunner.run(async (tx) => {
      await this.readingGoalsRepository.acquireCreateLock(listId, tx);
      const existing = await this.readingGoalsRepository.findActiveByListId({ listId, userId }, tx);
      if (existing !== null) {
        await this.archiveSuperseded({ existing, now, tx, userId });
      }
      const candidates = await this.readingGoalsRepository.findActiveListBooks(
        { listId, userId },
        tx,
      );
      this.inputValidator.assertTargetWithinBooks({
        bookCount: candidates.length,
        targetCount: input.targetCount,
      });
      const goal = await this.createGoal({
        data: { deadline, name: input.name ?? null, targetCount: input.targetCount },
        listId,
        tx,
        userId,
      });
      await this.snapshotService.seed({ candidates, goal, tx });
      await this.activityRecorder.recordCreation({ goal, now, tx });
      return goal;
    });

    return this.viewBuilder.build({ goal: created, now });
  }

  async delete({ goalId, userId }: GoalCommand): Promise<void> {
    const deleted = await this.readingGoalsRepository.deleteOwned({ goalId, userId });
    if (deleted === 0) {
      throw new NotFoundError(READING_GOAL_MESSAGE.notFound);
    }
  }

  async update({ goalId, input, userId }: UpdateInput): Promise<ReadingGoalView> {
    const now = new Date();
    const previous = await this.findOwnedOrThrow({ goalId, userId });
    if (previous.archivedAt !== null) {
      throw new BadRequestError(READING_GOAL_MESSAGE.archivedIsReadOnly);
    }
    const updated = await this.transactionRunner.run(async (tx) => {
      const data = await this.inputValidator.buildUpdateData({ goal: previous, input, now, tx });
      const goal = await this.readingGoalsRepository.update({ data, goalId, userId }, tx);
      if (goal === null) {
        throw new NotFoundError(READING_GOAL_MESSAGE.notFound);
      }
      const changes = deadlineChanged({ goal, previous })
        ? await this.snapshotService.resync({ goal, tx })
        : [];
      await this.activityRecorder.recordUpdate({ changes, goal, now, previous, tx });
      return goal;
    });

    return this.viewBuilder.build({ goal: updated, now });
  }

  private async archiveSuperseded({
    existing,
    now,
    tx,
    userId,
  }: {
    existing: ReadingGoalWithList;
    now: Date;
    tx: Prisma.TransactionClient;
    userId: string;
  }): Promise<void> {
    const view = await this.viewBuilder.build({ client: tx, goal: existing, now });
    if (view.status === "active") {
      throw new ConflictError(READING_GOAL_MESSAGE.activeGoalExists);
    }
    const archived = await this.readingGoalsRepository.archive(
      { archivedAt: now, goalId: existing.id, userId },
      tx,
    );
    if (archived === 0) {
      throw new ConflictError(READING_GOAL_MESSAGE.activeGoalExists);
    }
    const archivedGoal = { ...existing, archivedAt: now };
    const changes = await this.snapshotService.resync({ goal: archivedGoal, tx });
    await this.activityRecorder.recordArchive({ changes, goal: archivedGoal, now, tx });
  }

  private async createGoal({
    data,
    listId,
    tx,
    userId,
  }: {
    data: { deadline: Date; name: null | string; targetCount: number };
    listId: string;
    tx: Prisma.TransactionClient;
    userId: string;
  }): Promise<ReadingGoalWithList> {
    try {
      return await this.readingGoalsRepository.create({ data, listId, userId }, tx);
    } catch (error) {
      if (isUniqueConstraintErrorOn(error, ACTIVE_LIST_GOAL_INDEX)) {
        throw new ConflictError(READING_GOAL_MESSAGE.activeGoalExists);
      }
      throw error;
    }
  }

  private async findOwnedOrThrow(
    { goalId, userId }: GoalCommand,
    client?: Prisma.TransactionClient,
  ): Promise<ReadingGoalWithList> {
    const goal = await this.readingGoalsRepository.findOwnedById({ goalId, userId }, client);
    if (goal === null) {
      throw new NotFoundError(READING_GOAL_MESSAGE.notFound);
    }
    return goal;
  }
}

function deadlineChanged({
  goal,
  previous,
}: {
  goal: ReadingGoalWithList;
  previous: ReadingGoalWithList;
}): boolean {
  return !isEqual(previous.deadline, goal.deadline);
}
