import type { UpdateReadingGoalInput } from "@app/shared";

import { READING_GOAL_TARGET_MAX } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { isAfter } from "date-fns";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { ReadingGoalWithList } from "../infrastructure/reading-goals.repository.js";

import { BadRequestError } from "../../../core/exceptions/errors.js";
import { parseIsoDate, startOfUtcDay } from "../../../core/iso-date.js";
import { READING_GOAL_MESSAGE } from "../domain/reading-goal.constants.js";
import { ReadingGoalBooksRepository } from "../infrastructure/reading-goal-books.repository.js";

@Injectable()
export class ReadingGoalInputValidator {
  constructor(private readonly readingGoalBooksRepository: ReadingGoalBooksRepository) {}

  assertFutureDeadline({ deadline, now }: { deadline: string; now: Date }): Date {
    const parsed = parseIsoDate(deadline);
    if (!isAfter(parsed, startOfUtcDay(now))) {
      throw new BadRequestError(READING_GOAL_MESSAGE.deadlineNotInFuture, {
        fields: [{ field: "deadline", message: READING_GOAL_MESSAGE.deadlineNotInFuture }],
      });
    }
    return parsed;
  }

  assertTargetWithinBooks({
    bookCount,
    targetCount,
  }: {
    bookCount: number;
    targetCount: number;
  }): void {
    if (targetCount > Math.min(READING_GOAL_TARGET_MAX, bookCount)) {
      throw new BadRequestError(READING_GOAL_MESSAGE.targetAboveListSize, {
        fields: [{ field: "targetCount", message: READING_GOAL_MESSAGE.targetAboveListSize }],
      });
    }
  }

  async buildUpdateData({
    goal,
    input,
    now,
    tx,
  }: {
    goal: ReadingGoalWithList;
    input: UpdateReadingGoalInput;
    now: Date;
    tx: Prisma.TransactionClient;
  }): Promise<Prisma.ReadingGoalUpdateManyMutationInput> {
    const data: Prisma.ReadingGoalUpdateManyMutationInput = {};
    if (input.deadline !== undefined) {
      data.deadline = this.assertFutureDeadline({ deadline: input.deadline, now });
    }
    if (input.name !== undefined) {
      data.name = input.name;
    }
    if (input.targetCount !== undefined) {
      const bookCount = await this.readingGoalBooksRepository.countByGoal({ goalId: goal.id }, tx);
      this.assertTargetWithinBooks({ bookCount, targetCount: input.targetCount });
      data.targetCount = input.targetCount;
    }
    return data;
  }
}
