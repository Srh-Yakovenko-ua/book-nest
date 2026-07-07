import type {
  AddToReadingQueueInput,
  ReadingQueueItemView,
  ReadingQueueView,
  ReorderReadingQueueInput,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { ConflictError, NotFoundError, ValidationError } from "../../../core/exceptions/errors.js";
import { BookReadingService, BooksRepository, BookViewAssembler } from "../../books/index.js";
import { computeQueueInsertPosition } from "../domain/queue-position.js";
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
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, input.bookId);
    if (book.queuePosition !== null) {
      throw new ConflictError(ALREADY_IN_QUEUE_MESSAGE);
    }

    await this.transactionRunner.run(async (tx) => {
      const count = await this.readingQueueRepository.count(userId, tx);
      const result = computeQueueInsertPosition({
        count,
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
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    if (book.queuePosition === null) {
      throw new NotFoundError(NOT_IN_QUEUE_MESSAGE);
    }
    const removedPosition: number = book.queuePosition;

    await this.transactionRunner.run(async (tx) => {
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

    const current = await this.readingQueueRepository.findQueuedBookIds(userId);
    const currentIds = new Set(current);
    if (order.length !== currentIds.size || !order.every((bookId) => currentIds.has(bookId))) {
      throw new ValidationError(INVALID_ORDER_MESSAGE);
    }

    await this.transactionRunner.run(async (tx) => {
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
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    const queuePosition = book.queuePosition;

    await this.transactionRunner.run(async (tx) => {
      await this.bookReadingService.startReading(userId, bookId, tx);
      if (removeFromQueue && queuePosition !== null) {
        await this.readingQueueRepository.clearPosition(userId, bookId, tx);
        await this.readingQueueRepository.shiftUpAfter(userId, queuePosition, tx);
      }
    });

    return this.getQueue(userId);
  }
}
