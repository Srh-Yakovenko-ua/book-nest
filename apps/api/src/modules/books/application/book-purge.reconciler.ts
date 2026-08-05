import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import type { PurgeReconciler } from "../../../core/purge-reconciler.js";

import { createPurgeReconciler } from "../../../core/purge-reconciler.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { BooksRepository } from "../infrastructure/books.repository.js";
import { BookLifecycleService } from "./book-lifecycle.service.js";

@Injectable()
export class BookPurgeReconciler {
  private readonly reconciler: PurgeReconciler;

  constructor(booksRepository: BooksRepository, lifecycleService: BookLifecycleService) {
    this.reconciler = createPurgeReconciler({
      batchSize: TRASH_RETENTION.reconcileBatchSize,
      findCandidates: (args) => booksRepository.findPurgeCandidates(args),
      purge: ({ id, userId }) => lifecycleService.purge({ bookId: id, userId }),
      scope: "books",
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  sweep(): Promise<void> {
    return this.reconciler.sweep();
  }
}
