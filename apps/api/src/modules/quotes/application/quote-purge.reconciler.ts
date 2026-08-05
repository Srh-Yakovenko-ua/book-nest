import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import type { PurgeReconciler } from "../../../core/purge-reconciler.js";

import { createPurgeReconciler } from "../../../core/purge-reconciler.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { QuotesRepository } from "../infrastructure/quotes.repository.js";
import { QuoteLifecycleService } from "./quote-lifecycle.service.js";

@Injectable()
export class QuotePurgeReconciler {
  private readonly reconciler: PurgeReconciler;

  constructor(quotesRepository: QuotesRepository, lifecycleService: QuoteLifecycleService) {
    this.reconciler = createPurgeReconciler({
      batchSize: TRASH_RETENTION.reconcileBatchSize,
      findCandidates: (args) => quotesRepository.findPurgeCandidates(args),
      purge: ({ id, userId }) => lifecycleService.purge({ quoteId: id, userId }),
      scope: "quotes",
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  sweep(): Promise<void> {
    return this.reconciler.sweep();
  }
}
