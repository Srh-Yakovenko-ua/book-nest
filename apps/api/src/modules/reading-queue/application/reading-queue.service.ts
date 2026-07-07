import type { ReadingQueueItemView, ReadingQueueView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { BookViewAssembler } from "../../books/index.js";
import { ReadingQueueRepository } from "../infrastructure/reading-queue.repository.js";

@Injectable()
export class ReadingQueueService {
  constructor(
    private readonly bookViewAssembler: BookViewAssembler,
    private readonly readingQueueRepository: ReadingQueueRepository,
  ) {}

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
}
