import type {
  BookView,
  ChangeReadingStatusInput,
  Nullable,
  ReadingHistoryQuery,
  ReadingHistoryView,
  UpdateReadingProgressInput,
} from "@app/shared";

import { ReadingStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { ReadingProgressEventData } from "../infrastructure/books.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { ValidationError } from "../../../core/exceptions/errors.js";
import { parseIsoDate, toIsoDate } from "../../../core/iso-date.js";
import { ReadingGoalSyncService } from "../../reading-goals/index.js";
import { toReadingHistoryView } from "../domain/reading-history.mapper.js";
import { computeReadingProgressChange } from "../domain/reading-progress-transition.js";
import { computeReadingStatusChange } from "../domain/reading-status-transition.js";
import { BooksRepository } from "../infrastructure/books.repository.js";
import { BookViewAssembler } from "./book-view-assembler.js";

const PAGE_EXCEEDS_PAGES_MESSAGE = "Current page cannot exceed the page count";
const PAGE_BELOW_PROGRESS_MESSAGE = "Current page cannot be lower than the saved progress";

@Injectable()
export class BookReadingService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly viewAssembler: BookViewAssembler,
    private readonly transactionRunner: TransactionRunner,
    private readonly readingGoalSyncService: ReadingGoalSyncService,
  ) {}

  async changeReadingStatus(
    userId: string,
    bookId: string,
    input: ChangeReadingStatusInput,
  ): Promise<BookView> {
    await this.transactionRunner.run(async (tx) => {
      await this.booksRepository.acquireBookLock(bookId, tx);
      const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId, tx);

      if (
        input.currentPage !== undefined &&
        book.pagesCount !== null &&
        input.currentPage > book.pagesCount
      ) {
        throw new ValidationError(PAGE_EXCEEDS_PAGES_MESSAGE);
      }

      const changeDate = input.date ?? this.todayIso();

      const patch = computeReadingStatusChange({
        currentPage: input.currentPage,
        date: changeDate,
        existingStartedAt: book.readingProgress?.startedAt ?? null,
        hasExistingProgress: book.readingProgress !== null,
        impression: input.impression,
        note: input.note,
        pagesCount: book.pagesCount,
        rating: input.rating,
        resetProgress: input.resetProgress,
        targetStatus: input.status,
      });

      const event = this.buildProgressEvent({
        previousPage: book.readingProgress?.currentPage ?? 0,
        resolvedPage: patch.progress.currentPage,
        updateDate: changeDate,
      });

      await this.booksRepository.recordReadingStatusChange(
        {
          bookId,
          clearEvents: this.shouldClearReadingEvents(input),
          event,
          patch,
          userId,
        },
        tx,
      );

      await this.readingGoalSyncService.syncBooks({ bookIds: [bookId], client: tx, userId });
    });

    return this.viewAssembler.loadView({ bookId, userId });
  }

  async getReadingHistory(
    userId: string,
    bookId: string,
    query: ReadingHistoryQuery,
  ): Promise<ReadingHistoryView> {
    const book = await this.booksRepository.findReadingSnapshotOrThrow(userId, bookId);

    const events = await this.booksRepository.findReadingEvents({ bookId });

    return toReadingHistoryView({
      events,
      pagesCount: book.pagesCount,
      progress: {
        abandonedAt: book.readingProgress?.abandonedAt ?? null,
        currentPage: book.readingProgress?.currentPage ?? null,
        finishedAt: book.readingProgress?.finishedAt ?? null,
        lastProgressUpdateAt: book.readingProgress?.lastProgressUpdateAt ?? null,
        pausedAt: book.readingProgress?.pausedAt ?? null,
        startedAt: book.readingProgress?.startedAt ?? null,
      },
      query,
      readingStatus: ReadingStatusSchema.parse(book.readingStatus),
      today: new Date(),
    });
  }

  async startReading(
    userId: string,
    bookId: string,
    client?: Prisma.TransactionClient,
  ): Promise<void> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);

    const patch = computeReadingStatusChange({
      date: this.todayIso(),
      existingStartedAt: book.readingProgress?.startedAt ?? null,
      hasExistingProgress: book.readingProgress !== null,
      pagesCount: book.pagesCount,
      targetStatus: "reading",
    });

    await this.booksRepository.applyReadingChange(userId, bookId, patch, client);
    await this.readingGoalSyncService.syncBooks({ bookIds: [bookId], client, userId });
  }

  async updateReadingProgress(
    userId: string,
    bookId: string,
    input: UpdateReadingProgressInput,
  ): Promise<BookView> {
    await this.transactionRunner.run(async (tx) => {
      await this.booksRepository.acquireBookLock(bookId, tx);
      const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId, tx);

      if (book.pagesCount !== null && input.currentPage > book.pagesCount) {
        throw new ValidationError(PAGE_EXCEEDS_PAGES_MESSAGE);
      }

      const existingPage = book.readingProgress?.currentPage ?? null;
      if (existingPage !== null && input.currentPage < existingPage) {
        throw new ValidationError(PAGE_BELOW_PROGRESS_MESSAGE);
      }

      const updateDate = input.updateDate ?? this.todayIso();

      const patch = computeReadingProgressChange({
        currentPage: input.currentPage,
        currentStatus: ReadingStatusSchema.parse(book.readingStatus),
        existingStartedAt: book.readingProgress?.startedAt ?? null,
        markAsFinished: input.markAsFinished,
        pagesCount: book.pagesCount,
        updateDate,
      });

      const event = this.buildProgressEvent({
        previousPage: book.readingProgress?.currentPage ?? 0,
        resolvedPage: patch.progress.currentPage,
        updateDate,
      });

      await this.booksRepository.recordReadingProgress({ bookId, event, patch, userId }, tx);

      await this.readingGoalSyncService.syncBooks({ bookIds: [bookId], client: tx, userId });
    });

    return this.viewAssembler.loadView({ bookId, userId });
  }

  private buildProgressEvent(args: {
    previousPage: number;
    resolvedPage: Nullable<number> | undefined;
    updateDate: string;
  }): Nullable<ReadingProgressEventData> {
    const { previousPage, resolvedPage, updateDate } = args;
    if (resolvedPage === null || resolvedPage === undefined) {
      return null;
    }

    const pagesRead = resolvedPage - previousPage;
    if (pagesRead <= 0) {
      return null;
    }

    return { date: parseIsoDate(updateDate), page: resolvedPage, pagesRead };
  }

  private shouldClearReadingEvents(input: ChangeReadingStatusInput): boolean {
    return (
      input.resetProgress === true &&
      (input.status === "not_started" || input.status === "want_to_read")
    );
  }

  private todayIso(): string {
    return toIsoDate(new Date());
  }
}
