import type {
  AddToReadingQueueInput,
  ReadingQueueItemView,
  ReadingQueueSummaryView,
  ReadingQueueView,
  ReorderReadingQueueInput,
} from "@app/shared";

import { OwnershipStatusSchema, ReadingStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { ConflictError, NotFoundError, ValidationError } from "../../../core/exceptions/errors.js";
import { BookReadingService, BooksRepository, BookViewAssembler } from "../../books/index.js";
import { computeQueueInsertPosition } from "../domain/queue-position.js";
import {
  computeReadingQueueSummary,
  type ReadingQueueSummaryDomainRow,
} from "../domain/queue-summary.js";
import { ReadingQueueRepository } from "../infrastructure/reading-queue.repository.js";

const ALREADY_IN_QUEUE_MESSAGE = "Книга вже є в черзі читання";
const NOT_IN_QUEUE_MESSAGE = "Книга не в черзі читання";
const INVALID_ORDER_MESSAGE = "Некоректний порядок черги";

@Injectable()
export class ReadingQueueService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly bookReadingService: BookReadingService,
    private readonly bookViewAssembler: BookViewAssembler,
    private readonly readingQueueRepository: ReadingQueueRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async addToQueue(userId: string, input: AddToReadingQueueInput): Promise<ReadingQueueView> {
    await this.booksRepository.findOwnedByIdOrThrow(userId, input.bookId);

    await this.transactionRunner.run(async (tx) => {
      await this.readingQueueRepository.acquireUserQueueLock(userId, tx);

      const existingPosition = await this.readingQueueRepository.findQueuePosition(
        userId,
        input.bookId,
        tx,
      );
      if (existingPosition !== null) {
        throw new ConflictError(ALREADY_IN_QUEUE_MESSAGE);
      }

      const count = await this.readingQueueRepository.count(userId, tx);
      const maxPosition = await this.booksRepository.maxQueuePosition(userId, tx);
      const result = computeQueueInsertPosition({
        count,
        maxPosition,
        placement: input.placement,
        position: input.position,
      });
      if (!result.ok) {
        throw new ValidationError(result.message);
      }
      await this.readingQueueRepository.shiftDownFrom(userId, result.position, tx);
      await this.readingQueueRepository.setPosition(userId, input.bookId, result.position, tx);
    });

    return this.getQueue(userId);
  }

  async getQueue(userId: string): Promise<ReadingQueueView> {
    const books = await this.readingQueueRepository.listQueue(userId);
    const items = books.flatMap<ReadingQueueItemView>((book) => {
      if (book.queuePosition === null) {
        return [];
      }
      return [{ book: this.bookViewAssembler.viewOf(book), position: book.queuePosition }];
    });
    const totalPagesCount = items.reduce((total, item) => total + (item.book.pagesCount ?? 0), 0);

    return { count: items.length, items, totalPagesCount };
  }

  async removeFromQueue(userId: string, bookId: string): Promise<ReadingQueueView> {
    await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);

    await this.transactionRunner.run(async (tx) => {
      await this.readingQueueRepository.acquireUserQueueLock(userId, tx);

      const removedPosition = await this.readingQueueRepository.findQueuePosition(
        userId,
        bookId,
        tx,
      );
      if (removedPosition === null) {
        throw new NotFoundError(NOT_IN_QUEUE_MESSAGE);
      }
      await this.readingQueueRepository.clearPosition(userId, bookId, tx);
      await this.readingQueueRepository.shiftUpAfter(userId, removedPosition, tx);
    });

    return this.getQueue(userId);
  }

  async reorder(userId: string, input: ReorderReadingQueueInput): Promise<ReadingQueueView> {
    const order = input.order;
    if (new Set(order).size !== order.length) {
      throw new ValidationError(INVALID_ORDER_MESSAGE);
    }

    await this.transactionRunner.run(async (tx) => {
      await this.readingQueueRepository.acquireUserQueueLock(userId, tx);

      const current = await this.readingQueueRepository.findQueuedBookIds(userId, tx);
      const currentIds = new Set(current);
      if (order.length !== currentIds.size || !order.every((bookId) => currentIds.has(bookId))) {
        throw new ValidationError(INVALID_ORDER_MESSAGE);
      }

      for (const [index, bookId] of order.entries()) {
        await this.readingQueueRepository.setPosition(userId, bookId, index + 1, tx);
      }
    });

    return this.getQueue(userId);
  }

  async startReading(
    userId: string,
    bookId: string,
    removeFromQueue: boolean,
  ): Promise<ReadingQueueView> {
    await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);

    await this.transactionRunner.run(async (tx) => {
      await this.readingQueueRepository.acquireUserQueueLock(userId, tx);

      const queuePosition = await this.readingQueueRepository.findQueuePosition(userId, bookId, tx);
      await this.bookReadingService.startReading(userId, bookId, tx);
      if (removeFromQueue && queuePosition !== null) {
        await this.readingQueueRepository.clearPosition(userId, bookId, tx);
        await this.readingQueueRepository.shiftUpAfter(userId, queuePosition, tx);
      }
    });

    return this.getQueue(userId);
  }

  async summary(userId: string): Promise<ReadingQueueSummaryView> {
    const rows = await this.readingQueueRepository.loadSummaryRows(userId);
    const domainRows = rows.map<ReadingQueueSummaryDomainRow>((row) => ({
      ownershipStatus: OwnershipStatusSchema.parse(row.ownershipStatus),
      partNumber: row.partNumber,
      seriesBooks: (row.series?.books ?? []).map((seriesBook) => ({
        partNumber: seriesBook.partNumber,
        readingStatus: ReadingStatusSchema.parse(seriesBook.readingStatus),
      })),
      seriesId: row.seriesId,
    }));

    return computeReadingQueueSummary(domainRows);
  }
}
