import type { Queue } from "bullmq";

import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";

import { createLogger } from "../../../core/logger.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { BOOK_PURGE_JOB, BOOK_PURGE_QUEUE_NAME, type BookPurgeJob } from "../domain/book-purge.js";

const log = createLogger("books.purge-scheduler");

@Injectable()
export class BookPurgeScheduler {
  constructor(
    @InjectQueue(BOOK_PURGE_QUEUE_NAME)
    private readonly purgeQueue: Queue<BookPurgeJob>,
  ) {}

  async cancel(bookId: string): Promise<void> {
    try {
      await this.purgeQueue.remove(bookId);
    } catch (error) {
      log.warn({ bookId, err: error }, "failed to cancel book purge job");
    }
  }

  async schedule({ bookId, userId }: BookPurgeJob): Promise<void> {
    try {
      await this.purgeQueue.remove(bookId);
      await this.purgeQueue.add(
        BOOK_PURGE_JOB,
        { bookId, userId },
        { delay: TRASH_RETENTION.purgeDelayMs, jobId: bookId },
      );
    } catch (error) {
      log.warn({ bookId, err: error }, "failed to enqueue book purge job");
    }
  }

  async scheduleMany({ bookIds, userId }: { bookIds: string[]; userId: string }): Promise<void> {
    for (const bookId of bookIds) {
      await this.schedule({ bookId, userId });
    }
  }
}
