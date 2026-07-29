import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { createLogger } from "../../../core/logger.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { BOOK_PURGE_RECONCILE_BATCH } from "../domain/book-purge.js";
import { BooksRepository } from "../infrastructure/books.repository.js";
import { BookLifecycleService } from "./book-lifecycle.service.js";

const log = createLogger("books.purge-reconciler");

@Injectable()
export class BookPurgeReconciler {
  private isRunning = false;

  constructor(
    private readonly booksRepository: BooksRepository,
    private readonly lifecycleService: BookLifecycleService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep(): Promise<void> {
    if (this.isRunning) {
      log.warn("book purge reconciliation still running, skipping this tick");
      return;
    }
    this.isRunning = true;
    try {
      await this.runSweep();
    } finally {
      this.isRunning = false;
    }
  }

  private async runSweep(): Promise<void> {
    const deletedBefore = TRASH_RETENTION.purgeThreshold(new Date());

    let candidates: { id: string; userId: string }[];
    try {
      candidates = await this.booksRepository.findPurgeCandidates({
        deletedBefore,
        limit: BOOK_PURGE_RECONCILE_BATCH,
      });
    } catch (error) {
      log.error({ err: error }, "book purge reconciliation failed to load candidates");
      return;
    }

    if (candidates.length === 0) {
      return;
    }

    const purgedIds: string[] = [];
    for (const candidate of candidates) {
      try {
        await this.lifecycleService.purge({ bookId: candidate.id, userId: candidate.userId });
        purgedIds.push(candidate.id);
      } catch (error) {
        log.error(
          { bookId: candidate.id, err: error },
          "book purge reconciliation failed for book",
        );
      }
    }

    if (purgedIds.length > 0) {
      log.info({ bookIds: purgedIds, count: purgedIds.length }, "reconciled overdue book purges");
    }
  }
}
