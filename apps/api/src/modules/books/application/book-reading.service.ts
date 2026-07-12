import type {
  BookView,
  ChangeReadingStatusInput,
  Nullable,
  ReadingHistoryView,
  UpdateReadingProgressInput,
} from "@app/shared";

import { ReadingStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { ReadingProgressEventData } from "../infrastructure/books.repository.js";

import { ValidationError } from "../../../core/exceptions/errors.js";
import { parseIsoDate, toIsoDate } from "../../../core/iso-date.js";
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
  ) {}

  async changeReadingStatus(
    userId: string,
    bookId: string,
    input: ChangeReadingStatusInput,
  ): Promise<BookView> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);

    if (
      input.currentPage !== undefined &&
      book.pagesCount !== null &&
      input.currentPage > book.pagesCount
    ) {
      throw new ValidationError(PAGE_EXCEEDS_PAGES_MESSAGE);
    }

    const patch = computeReadingStatusChange({
      currentPage: input.currentPage,
      date: input.date ?? this.todayIso(),
      existingStartedAt: book.readingProgress?.startedAt ?? null,
      hasExistingProgress: book.readingProgress !== null,
      impression: input.impression,
      note: input.note,
      pagesCount: book.pagesCount,
      rating: input.rating,
      resetProgress: input.resetProgress,
      targetStatus: input.status,
    });

    await this.booksRepository.applyReadingChange(userId, bookId, patch);

    return this.viewAssembler.loadView({ bookId, userId });
  }

  async getReadingHistory(userId: string, bookId: string): Promise<ReadingHistoryView> {
    await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);

    const events = await this.booksRepository.findReadingEvents({ bookId });

    return toReadingHistoryView({ events });
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
  }

  async updateReadingProgress(
    userId: string,
    bookId: string,
    input: UpdateReadingProgressInput,
  ): Promise<BookView> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);

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

    await this.booksRepository.recordReadingProgress({ bookId, event, patch, userId });

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

  private todayIso(): string {
    return toIsoDate(new Date());
  }
}
