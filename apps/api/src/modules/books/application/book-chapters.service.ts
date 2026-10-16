import type { BookChaptersView } from "@app/shared";

import { BOOK_CHAPTER_USAGE_MAX } from "@app/shared";
import { Injectable } from "@nestjs/common";

import { mergeTextUsage } from "../../../core/text-usage.js";
import { BookChaptersRepository } from "../infrastructure/book-chapters.repository.js";
import { BooksRepository } from "../infrastructure/books.repository.js";
import { assertBookOwned } from "./assert-book-owned.js";

@Injectable()
export class BookChaptersService {
  constructor(
    private readonly bookChaptersRepository: BookChaptersRepository,
    private readonly booksRepository: BooksRepository,
  ) {}

  async getChapters({
    bookId,
    userId,
  }: {
    bookId: string;
    userId: string;
  }): Promise<BookChaptersView> {
    await assertBookOwned({ bookId, booksRepository: this.booksRepository, userId });
    const rows = await this.bookChaptersRepository.findChapterUsage({ bookId });
    const merged = mergeTextUsage({
      limit: BOOK_CHAPTER_USAGE_MAX,
      usages: rows.map((row) => ({ count: row.count, text: row.chapter })),
    });
    return { chapters: merged.map((usage) => ({ chapter: usage.text, count: usage.count })) };
  }
}
