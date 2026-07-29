import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { createLogger } from "../../../core/logger.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { QUOTE_PURGE_RECONCILE_BATCH } from "../domain/quote-purge.js";
import { QuotesRepository } from "../infrastructure/quotes.repository.js";
import { QuoteLifecycleService } from "./quote-lifecycle.service.js";

const log = createLogger("quotes.purge-reconciler");

@Injectable()
export class QuotePurgeReconciler {
  private isRunning = false;

  constructor(
    private readonly quotesRepository: QuotesRepository,
    private readonly lifecycleService: QuoteLifecycleService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep(): Promise<void> {
    if (this.isRunning) {
      log.warn("quote purge reconciliation still running, skipping this tick");
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
      candidates = await this.quotesRepository.findPurgeCandidates({
        deletedBefore,
        limit: QUOTE_PURGE_RECONCILE_BATCH,
      });
    } catch (error) {
      log.error({ err: error }, "quote purge reconciliation failed to load candidates");
      return;
    }

    if (candidates.length === 0) {
      return;
    }

    const purgedIds: string[] = [];
    for (const candidate of candidates) {
      try {
        await this.lifecycleService.purge({ quoteId: candidate.id, userId: candidate.userId });
        purgedIds.push(candidate.id);
      } catch (error) {
        log.error(
          { err: error, quoteId: candidate.id },
          "quote purge reconciliation failed for quote",
        );
      }
    }

    if (purgedIds.length > 0) {
      log.info({ count: purgedIds.length, quoteIds: purgedIds }, "reconciled overdue quote purges");
    }
  }
}
