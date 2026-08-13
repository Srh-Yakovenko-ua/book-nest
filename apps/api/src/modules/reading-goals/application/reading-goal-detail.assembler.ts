import type { Nullable, ReadingGoalDetail, ReadingGoalView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { ReadingGoalWithList } from "../infrastructure/reading-goals.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { startOfUtcDay } from "../../../core/iso-date.js";
import { ListsService } from "../../lists/index.js";
import { buildReadingGoalCheckpoints } from "../domain/reading-goal-checkpoints.js";
import { READING_GOAL_LIMITS, READING_GOAL_MESSAGE } from "../domain/reading-goal.constants.js";
import { ReadingGoalsRepository } from "../infrastructure/reading-goals.repository.js";
import { ReadingGoalActivityService } from "./reading-goal-activity.service.js";
import { ReadingGoalBooksService } from "./reading-goal-books.service.js";
import { ReadingGoalViewBuilder } from "./reading-goal-view.builder.js";

@Injectable()
export class ReadingGoalDetailAssembler {
  constructor(
    private readonly readingGoalsRepository: ReadingGoalsRepository,
    private readonly listsService: ListsService,
    private readonly viewBuilder: ReadingGoalViewBuilder,
    private readonly goalBooksService: ReadingGoalBooksService,
    private readonly goalActivityService: ReadingGoalActivityService,
  ) {}

  async findActiveByList({
    listId,
    userId,
  }: {
    listId: string;
    userId: string;
  }): Promise<Nullable<ReadingGoalView>> {
    await this.listsService.assertOwned({ listId, userId });
    const goal = await this.readingGoalsRepository.findActiveByListId({ listId, userId });
    if (goal === null) {
      return null;
    }
    return this.viewBuilder.build({ goal, now: new Date() });
  }

  async findDetail({
    goalId,
    userId,
  }: {
    goalId: string;
    userId: string;
  }): Promise<ReadingGoalDetail> {
    const goal = await this.readingGoalsRepository.findOwnedById({ goalId, userId });
    if (goal === null) {
      throw new NotFoundError(READING_GOAL_MESSAGE.notFound);
    }

    const now = new Date();
    const [preview, activityPreview, listBookCount] = await Promise.all([
      this.goalBooksService.preview({ goalId, limit: READING_GOAL_LIMITS.detailBooksPreview }),
      this.goalActivityService.preview({ goalId, limit: READING_GOAL_LIMITS.activityPreview }),
      this.countListBooks(goal),
    ]);

    return {
      ...this.viewBuilder.buildListItemFrom({ goal, now, snapshotBooks: preview.snapshotBooks }),
      activityPreview,
      checkpoints: buildReadingGoalCheckpoints({
        archivedAt: goal.archivedAt,
        books: preview.snapshotBooks.map((book) => ({
          bookId: book.bookId,
          finishedAt: book.qualifiedFinishedAt,
        })),
        deadline: goal.deadline,
        goalStartDate: startOfUtcDay(goal.createdAt),
        now,
        targetCount: goal.targetCount,
      }),
      countedBooks: preview.countedBooks,
      listBookCount,
      remainingBooks: preview.remainingBooks,
      snapshotBookCount: preview.snapshotBookCount,
    };
  }

  private countListBooks({ listId }: ReadingGoalWithList): Promise<number> {
    if (listId === null) {
      return Promise.resolve(0);
    }
    return this.listsService.countActiveBooks({ listId });
  }
}
