import type {
  BookDeletionResult,
  BookView,
  PaginatedTrashedBooks,
  TrashedBooksQuery,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { createLogger } from "../../../core/logger.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { MediaService } from "../../media/index.js";
import { type BookPurgeJob, collectMediaIds } from "../domain/book-purge.js";
import { toTrashedBookView } from "../domain/trashed-book.mapper.js";
import { BooksRepository } from "../infrastructure/books.repository.js";
import { BookPurgeScheduler } from "./book-purge.scheduler.js";
import { BookViewAssembler } from "./book-view-assembler.js";

const log = createLogger("books.lifecycle");

@Injectable()
export class BookLifecycleService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly viewAssembler: BookViewAssembler,
    private readonly mediaService: MediaService,
    private readonly purgeScheduler: BookPurgeScheduler,
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
      deletedBefore: TRASH_RETENTION.purgeThreshold(new Date()),
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
    const restored = await this.booksRepository.restore({ bookId, userId });
    if (restored === 0) {
      throw new NotFoundError("Book not found");
    }

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
    const deletedAt = new Date();
    const affected = await this.booksRepository.softDelete({ bookId, deletedAt, userId });
    if (affected === 0) {
      throw new NotFoundError("Book not found");
    }

    await this.purgeScheduler.schedule({ bookId, userId });

    return {
      bookId,
      deletedAt: deletedAt.toISOString(),
      purgeAt: TRASH_RETENTION.purgeAfter(deletedAt).toISOString(),
    };
  }
}
