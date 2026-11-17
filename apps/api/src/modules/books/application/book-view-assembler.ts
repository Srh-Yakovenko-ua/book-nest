import type { BookView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { MediaService } from "../../media/index.js";
import { UserSettingsContextService } from "../../profile/index.js";
import { toBookView } from "../domain/book.mapper.js";
import { BooksRepository, type BookWithRelations } from "../infrastructure/books.repository.js";

@Injectable()
export class BookViewAssembler {
  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly mediaService: MediaService,
    private readonly userSettingsContextService: UserSettingsContextService,
  ) {}

  async forUser(userId: string): Promise<(book: BookWithRelations) => BookView> {
    const today = await this.userSettingsContextService.calendarDay({ now: new Date(), userId });
    return (book) => this.viewOf({ book, today });
  }

  async loadView({ bookId, userId }: { bookId: string; userId: string }): Promise<BookView> {
    const [book, toUserBookView] = await Promise.all([
      this.booksRepository.findOwnedByIdOrThrow(userId, bookId),
      this.forUser(userId),
    ]);
    return toUserBookView(book);
  }

  viewOf({ book, today }: { book: BookWithRelations; today: Date }): BookView {
    return toBookView({
      book,
      cover: this.mediaService.buildViewOrNull(book.coverMedia),
      today,
    });
  }
}
