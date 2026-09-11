import type { Nullable, PostFinishQuotesView, QuotePostFinishReviewInput } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { parseIsoDate } from "../../../core/iso-date.js";
import { MediaService } from "../../media/index.js";
import { UserSettingsContextService } from "../../profile/index.js";
import { postFinishWindow, selectPostFinishCandidate } from "../domain/quote-post-finish.js";
import { toPostFinishQuotesView } from "../domain/quote-post-finish.mapper.js";
import { QuotePostFinishRepository } from "../infrastructure/quote-post-finish.repository.js";

const READING_CYCLE_NOT_FOUND_MESSAGE = "Reading cycle was not found";

@Injectable()
export class QuotePostFinishService {
  constructor(
    private readonly mediaService: MediaService,
    private readonly postFinishRepository: QuotePostFinishRepository,
    private readonly userSettingsContextService: UserSettingsContextService,
  ) {}

  async recordReview({
    input,
    userId,
  }: {
    input: QuotePostFinishReviewInput;
    userId: string;
  }): Promise<void> {
    const ownedCycles = await this.postFinishRepository.countOwnedCycles({
      readingCycleId: input.readingCycleId,
      userId,
    });
    if (ownedCycles === 0) {
      throw new NotFoundError(READING_CYCLE_NOT_FOUND_MESSAGE);
    }

    await this.postFinishRepository.recordReview({
      readingCycleId: input.readingCycleId,
      reviewedAt: new Date(),
      userId,
    });
  }

  async selectPostFinish({ userId }: { userId: string }): Promise<Nullable<PostFinishQuotesView>> {
    const today = await this.userSettingsContextService.today(userId);
    const { earliestFinishedOn, latestFinishedOn } = postFinishWindow(today);

    const candidates = await this.postFinishRepository.listUnreviewedFinishedCycles({
      finishedFrom: parseIsoDate(earliestFinishedOn),
      finishedTo: parseIsoDate(latestFinishedOn),
      userId,
    });
    if (candidates.length === 0) {
      return null;
    }

    const countRows = await this.postFinishRepository.aggregateActiveQuoteCounts({
      bookIds: [...new Set(candidates.map((candidate) => candidate.bookId))],
      userId,
    });
    const selection = selectPostFinishCandidate({
      candidates,
      countsByBookId: new Map(countRows.map((row) => [row.bookId, row])),
    });
    if (selection === null) {
      return null;
    }

    const book = await this.postFinishRepository.findBookPreview({
      bookId: selection.candidate.bookId,
      userId,
    });
    if (book === null) {
      return null;
    }

    return toPostFinishQuotesView({
      book,
      candidate: selection.candidate,
      counts: selection.counts,
      cover: this.mediaService.buildViewOrNull(book.coverMedia),
    });
  }
}
