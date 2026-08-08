import type { Nullable, ReadingGoalBook, ReadingGoalDetail, ReadingGoalView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { CountedBookRow } from "../infrastructure/reading-goals.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { toIsoDate } from "../../../core/iso-date.js";
import { createLogger } from "../../../core/logger.js";
import { ListsService } from "../../lists/index.js";
import { MediaService } from "../../media/index.js";
import { READING_GOAL_LIMITS, READING_GOAL_MESSAGE } from "../domain/reading-goal.constants.js";
import { ReadingGoalsRepository } from "../infrastructure/reading-goals.repository.js";
import { ReadingGoalViewBuilder } from "./reading-goal-view.builder.js";

const log = createLogger("reading-goals.detail-assembler");

@Injectable()
export class ReadingGoalDetailAssembler {
  constructor(
    private readonly readingGoalsRepository: ReadingGoalsRepository,
    private readonly listsService: ListsService,
    private readonly mediaService: MediaService,
    private readonly viewBuilder: ReadingGoalViewBuilder,
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
    const view = await this.viewBuilder.build({ goal, now: new Date() });
    if (goal.listId === null) {
      return { ...view, countedBooks: [], listBookCount: 0 };
    }
    const [rows, listBookCount] = await Promise.all([
      this.readingGoalsRepository.findCountedBooks({
        limit: READING_GOAL_LIMITS.countedBooks,
        listId: goal.listId,
        since: this.viewBuilder.countedSince(goal),
        userId,
      }),
      this.listsService.countActiveBooks({ listId: goal.listId }),
    ]);
    if (rows.length === READING_GOAL_LIMITS.countedBooks) {
      log.warn(
        { cap: READING_GOAL_LIMITS.countedBooks, goalId },
        "counted books truncated at the safety cap",
      );
    }
    return {
      ...view,
      countedBooks: rows.flatMap((row) => this.toCountedBook(row)),
      listBookCount,
    };
  }

  private toCountedBook(row: CountedBookRow): ReadingGoalBook[] {
    const finishedAt = row.readingProgress?.finishedAt ?? null;
    if (finishedAt === null) {
      return [];
    }
    return [
      {
        authors: row.authors.map((link) => ({ id: link.author.id, name: link.author.name })),
        cover: this.mediaService.buildViewOrNull(row.coverMedia),
        finishedAt: toIsoDate(finishedAt),
        id: row.id,
        title: row.title,
      },
    ];
  }
}
