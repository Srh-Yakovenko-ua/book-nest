import type {
  BookDeletionResult,
  BookView,
  PaginatedTrashedBooks,
  TrashedBooksQuery,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { MediaService } from "../../media/index.js";
import { toTrashedBookView } from "../domain/trashed-book.mapper.js";
import { BooksRepository } from "../infrastructure/books.repository.js";
import { BookViewAssembler } from "./book-view-assembler.js";

@Injectable()
export class BookLifecycleService {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly viewAssembler: BookViewAssembler,
    private readonly mediaService: MediaService,
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

  async restore({ bookId, userId }: { bookId: string; userId: string }): Promise<BookView> {
    const restored = await this.booksRepository.restore({ bookId, userId });
    if (restored === 0) {
      throw new NotFoundError("Book not found");
    }

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

    return {
      bookId,
      deletedAt: deletedAt.toISOString(),
      purgeAt: TRASH_RETENTION.purgeAfter(deletedAt).toISOString(),
    };
  }
}
