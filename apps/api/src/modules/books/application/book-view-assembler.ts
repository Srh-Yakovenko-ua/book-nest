import type { BookView, MediaView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { createLogger } from "../../../core/logger.js";
import { MediaService } from "../../media/index.js";
import { toBookView } from "../domain/book.mapper.js";
import { BooksRepository, type BookWithRelations } from "../infrastructure/books.repository.js";

const log = createLogger("books.view");

@Injectable()
export class BookViewAssembler {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly mediaService: MediaService,
  ) {}

  async loadView({ bookId, userId }: { bookId: string; userId: string }): Promise<BookView> {
    const book = await this.booksRepository.findOwnedByIdOrThrow(userId, bookId);
    return this.viewOf(book);
  }

  viewOf(book: BookWithRelations): BookView {
    return toBookView(book, this.coverViewOf(book));
  }

  private coverViewOf(book: BookWithRelations): MediaView | null {
    if (book.coverMedia === null) {
      return null;
    }
    try {
      return this.mediaService.buildView(book.coverMedia);
    } catch (error) {
      log.warn({ bookId: book.id, err: error }, "failed to build cover view");
      return null;
    }
  }
}
