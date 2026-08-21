import type {
  BookDeletionResult,
  BookView,
  PaginatedTrashedBooks,
  TrashedBooksQuery,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { createLogger } from "../../../core/logger.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { isUniqueConstraintError } from "../../../core/prisma-errors.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { MediaService } from "../../media/index.js";
import { ReadingGoalSyncService } from "../../reading-goals/index.js";
import { type BookPurgeJob, collectMediaIds } from "../domain/book-purge.js";
import { toTrashedBookView } from "../domain/trashed-book.mapper.js";
import { BooksRepository } from "../infrastructure/books.repository.js";
import { BookPurgeScheduler } from "./book-purge.scheduler.js";
import { BookViewAssembler } from "./book-view-assembler.js";

const log = createLogger("books.lifecycle");

const PART_NUMBER_TAKEN_MESSAGE =
  "That part number is taken by another book in the series; free it before restoring";

@Injectable()
export class BookLifecycleService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly viewAssembler: BookViewAssembler,
    private readonly mediaService: MediaService,
    private readonly purgeScheduler: BookPurgeScheduler,
    private readonly transactionRunner: TransactionRunner,
    private readonly readingGoalSyncService: ReadingGoalSyncService,
  ) {}

  async listTrash({
    query,
    userId,
  }: {
    query: TrashedBooksQuery;
    userId: string;
  }): Promise<PaginatedTrashedBooks> {
    const { skip, take } = pageSlice(query);
    const [rows, totalCount] = await Promise.all([
      this.booksRepository.listTrashed({ skip, take, userId }),
      this.booksRepository.countTrashed({ userId }),
    ]);

    return buildPaginator({
      items: rows.map((book) =>
        toTrashedBookView({ book, cover: this.mediaService.buildViewOrNull(book.coverMedia) }),
      ),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount,
    });
  }

  async purge({ bookId, userId }: BookPurgeJob): Promise<void> {
    const book = await this.booksRepository.findForPurge({ bookId, userId });
    if (book === null || book.deletedAt === null) {
      return;
    }

    const mediaIds = collectMediaIds(book);
    const purged = await this.booksRepository.hardDeleteIfTrashed({
      bookId,
      now: new Date(),
      userId,
    });
    if (purged === 0) {
      return;
    }

    for (const mediaId of mediaIds) {
      try {
        await this.mediaService.deleteIfUnreferenced({ id: mediaId, userId });
      } catch (error) {
        log.warn({ err: error, mediaId }, "failed to clean up orphaned book media");
      }
    }
  }

  async restore({ bookId, userId }: { bookId: string; userId: string }): Promise<BookView> {
    await this.transactionRunner.run(async (tx) => {
      const restored = await this.restoreRow({ bookId, tx, userId });
      if (restored === 0) {
        throw new NotFoundError("Book not found");
      }
      await this.readingGoalSyncService.syncBooks({ bookIds: [bookId], client: tx, userId });
    });

    await this.purgeScheduler.cancel(bookId);
    return this.viewAssembler.loadView({ bookId, userId });
  }

  async softDelete({
    bookId,
    userId,
  }: {
    bookId: string;
    userId: string;
  }): Promise<BookDeletionResult> {
    const stamp = TRASH_RETENTION.stamp();
    await this.transactionRunner.run(async (tx) => {
      const affected = await this.booksRepository.softDelete({ bookId, stamp, userId }, tx);
      if (affected === 0) {
        throw new NotFoundError("Book not found");
      }
      await this.readingGoalSyncService.syncBooks({ bookIds: [bookId], client: tx, userId });
    });

    await this.purgeScheduler.schedule({ bookId, userId });

    return {
      bookId,
      deletedAt: stamp.deletedAt.toISOString(),
      purgeAt: stamp.purgeAt.toISOString(),
    };
  }

  private async restoreRow({
    bookId,
    tx,
    userId,
  }: {
    bookId: string;
    tx: Prisma.TransactionClient;
    userId: string;
  }): Promise<number> {
    try {
      return await this.booksRepository.restore({ bookId, userId }, tx);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError(PART_NUMBER_TAKEN_MESSAGE);
      }
      throw error;
    }
  }
}
