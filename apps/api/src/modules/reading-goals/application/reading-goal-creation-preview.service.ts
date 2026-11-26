import type { ReadingGoalCreationPreview, ReadingGoalCreationPreviewQuery } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { ListsService } from "../../lists/index.js";
import { UserSettingsContextService } from "../../profile/index.js";
import { selectQualifyingReadingGoalBooks } from "../domain/reading-goal-progress.js";
import { resolveReadingGoalCountingEnd } from "../domain/reading-goal-window.js";
import { ReadingGoalBooksRepository } from "../infrastructure/reading-goal-books.repository.js";
import { ReadingGoalsRepository } from "../infrastructure/reading-goals.repository.js";
import { ReadingGoalInputValidator } from "./reading-goal-input.validator.js";

type PreviewInput = {
  listId: string;
  query: ReadingGoalCreationPreviewQuery;
  userId: string;
};

@Injectable()
export class ReadingGoalCreationPreviewService {
  constructor(
    private readonly listsService: ListsService,
    private readonly userSettingsContextService: UserSettingsContextService,
    private readonly inputValidator: ReadingGoalInputValidator,
    private readonly readingGoalsRepository: ReadingGoalsRepository,
    private readonly readingGoalBooksRepository: ReadingGoalBooksRepository,
  ) {}

  async preview({ listId, query, userId }: PreviewInput): Promise<ReadingGoalCreationPreview> {
    const now = new Date();
    await this.listsService.assertOwned({ listId, userId });
    const { timeZone, today } = await this.userSettingsContextService.calendar({ now, userId });
    const deadline =
      query.deadline === undefined
        ? today
        : this.inputValidator.assertFutureDeadline({ deadline: query.deadline, today });

    const [candidates, finishes] = await Promise.all([
      this.readingGoalsRepository.findActiveListBooks({ listId, userId }),
      this.readingGoalBooksRepository.findEarliestListBookFinishes({
        listId,
        now,
        timeZone,
        userId,
      }),
    ]);
    const counted = selectQualifyingReadingGoalBooks({
      books: finishes,
      countingEndsAt: resolveReadingGoalCountingEnd({ archivedDay: null, deadline }),
      goalStartDate: today,
    });

    return { bookCount: candidates.length, countedCount: counted.length };
  }
}
