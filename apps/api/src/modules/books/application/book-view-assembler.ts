import type { BookView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { startOfUtcDay } from "../../../core/iso-date.js";
import { MediaService } from "../../media/index.js";
import { toBookView } from "../domain/book.mapper.js";
import { BooksRepository, type BookWithRelations } from "../infrastructure/books.repository.js";

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
    return toBookView({
      book,
      cover: this.mediaService.buildViewOrNull(book.coverMedia),
      today: startOfUtcDay(new Date()),
    });
  }
}
