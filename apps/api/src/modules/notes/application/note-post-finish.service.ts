import type { NotePostFinishReviewInput, Nullable, PostFinishNotesView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { parseIsoDate } from "../../../core/iso-date.js";
import { MediaService } from "../../media/index.js";
import { UserSettingsContextService } from "../../profile/index.js";
import {
  notePostFinishWindow,
  selectNotePostFinishCandidate,
  toPostFinishNotesView,
} from "../domain/note-post-finish.js";
import { NotePostFinishRepository } from "../infrastructure/note-post-finish.repository.js";

const READING_CYCLE_NOT_FOUND_MESSAGE = "Reading cycle was not found";

@Injectable()
export class NotePostFinishService {
  constructor(
    private readonly mediaService: MediaService,
    private readonly postFinishRepository: NotePostFinishRepository,
    private readonly userSettingsContextService: UserSettingsContextService,
  ) {}

  async recordReview({
    input,
    userId,
  }: {
    input: NotePostFinishReviewInput;
    userId: string;
  }): Promise<void> {
    const finishedCycles = await this.postFinishRepository.countOwnedFinishedCycles({
      readingCycleId: input.readingCycleId,
      userId,
    });
    if (finishedCycles === 0) {
      throw new NotFoundError(READING_CYCLE_NOT_FOUND_MESSAGE);
    }

    await this.postFinishRepository.recordReview({
      readingCycleId: input.readingCycleId,
      reviewedAt: new Date(),
      userId,
    });
  }

  async selectPostFinish({ userId }: { userId: string }): Promise<Nullable<PostFinishNotesView>> {
    const today = await this.userSettingsContextService.today(userId);
    const { earliestFinishedOn, latestFinishedOn } = notePostFinishWindow(today);

    const candidates = await this.postFinishRepository.listUnreviewedFinishedCycles({
      finishedFrom: parseIsoDate(earliestFinishedOn),
      finishedTo: parseIsoDate(latestFinishedOn),
      userId,
    });
    if (candidates.length === 0) {
      return null;
    }

    const countRows = await this.postFinishRepository.aggregateActiveNoteCounts({
      bookIds: [...new Set(candidates.map((candidate) => candidate.bookId))],
      userId,
    });
    const selection = selectNotePostFinishCandidate({
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

    return toPostFinishNotesView({
      book,
      cover: this.mediaService.buildViewOrNull(book.coverMedia),
      selection,
    });
  }
}
