import type { CreateReadingGoalInput, ReadingGoalView, UpdateReadingGoalInput } from "@app/shared";

import { READING_GOAL_TARGET_MAX } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { isAfter } from "date-fns";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { ReadingGoalWithList } from "../infrastructure/reading-goals.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { parseIsoDate, startOfUtcDay } from "../../../core/iso-date.js";
import { isUniqueConstraintErrorOn } from "../../../core/prisma-errors.js";
import { ListsService } from "../../lists/index.js";
import { ACTIVE_LIST_GOAL_INDEX, READING_GOAL_MESSAGE } from "../domain/reading-goal.constants.js";
import { ReadingGoalsRepository } from "../infrastructure/reading-goals.repository.js";
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
  ) {}

  async archive({ goalId, userId }: GoalCommand): Promise<ReadingGoalView> {
    const now = new Date();
    const goal = await this.findOwnedOrThrow({ goalId, userId });
    if (goal.archivedAt !== null) {
      return this.viewBuilder.build({ goal, now });
    }
    await this.readingGoalsRepository.archive({ archivedAt: now, goalId, userId });
    const archived = await this.findOwnedOrThrow({ goalId, userId });
    return this.viewBuilder.build({ goal: archived, now });
  }

  async create({ input, listId, userId }: CreateInput): Promise<ReadingGoalView> {
    const now = new Date();
    await this.listsService.assertOwned({ listId, userId });
    const deadline = this.assertFutureDeadline({ deadline: input.deadline, now });
    await this.assertTargetWithinList({ listId, targetCount: input.targetCount });

    const created = await this.transactionRunner.run(async (tx) => {
      await this.readingGoalsRepository.acquireCreateLock(listId, tx);
      const existing = await this.readingGoalsRepository.findActiveByListId({ listId, userId }, tx);
      if (existing !== null) {
        await this.archiveSuperseded({ existing, now, tx, userId });
      }
      return this.createGoal({
        data: { deadline, name: input.name ?? null, targetCount: input.targetCount },
        listId,
        tx,
        userId,
      });
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
    const goal = await this.findOwnedOrThrow({ goalId, userId });
    if (goal.archivedAt !== null) {
      throw new BadRequestError(READING_GOAL_MESSAGE.archivedIsReadOnly);
    }
    const data = await this.buildUpdateData({ goal, input, now });
    const updated = await this.readingGoalsRepository.update({ data, goalId, userId });
    if (updated === null) {
      throw new NotFoundError(READING_GOAL_MESSAGE.notFound);
    }
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
  }

  private assertFutureDeadline({ deadline, now }: { deadline: string; now: Date }): Date {
    const parsed = parseIsoDate(deadline);
    if (!isAfter(parsed, startOfUtcDay(now))) {
      throw new BadRequestError(READING_GOAL_MESSAGE.deadlineNotInFuture, {
        fields: [{ field: "deadline", message: READING_GOAL_MESSAGE.deadlineNotInFuture }],
      });
    }
    return parsed;
  }

  private async assertTargetWithinList({
    listId,
    targetCount,
  }: {
    listId: string;
    targetCount: number;
  }): Promise<void> {
    const listBookCount = await this.listsService.countActiveBooks({ listId });
    const maxTarget = Math.min(READING_GOAL_TARGET_MAX, listBookCount);
    if (targetCount > maxTarget) {
      throw new BadRequestError(READING_GOAL_MESSAGE.targetAboveListSize, {
        fields: [{ field: "targetCount", message: READING_GOAL_MESSAGE.targetAboveListSize }],
      });
    }
  }

  private async buildUpdateData({
    goal,
    input,
    now,
  }: {
    goal: ReadingGoalWithList;
    input: UpdateReadingGoalInput;
    now: Date;
  }): Promise<Prisma.ReadingGoalUpdateManyMutationInput> {
    const data: Prisma.ReadingGoalUpdateManyMutationInput = {};
    if (input.deadline !== undefined) {
      data.deadline = this.assertFutureDeadline({ deadline: input.deadline, now });
    }
    if (input.name !== undefined) {
      data.name = input.name;
    }
    if (input.targetCount !== undefined) {
      if (goal.listId !== null) {
        await this.assertTargetWithinList({ listId: goal.listId, targetCount: input.targetCount });
      }
      data.targetCount = input.targetCount;
    }
    return data;
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

  private async findOwnedOrThrow({ goalId, userId }: GoalCommand): Promise<ReadingGoalWithList> {
    const goal = await this.readingGoalsRepository.findOwnedById({ goalId, userId });
    if (goal === null) {
      throw new NotFoundError(READING_GOAL_MESSAGE.notFound);
    }
    return goal;
  }
}
