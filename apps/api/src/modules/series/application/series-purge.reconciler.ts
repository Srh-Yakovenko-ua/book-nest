import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { createLogger } from "../../../core/logger.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { SERIES_PURGE_RECONCILE_BATCH } from "../domain/series-purge.js";
import { SeriesRepository } from "../infrastructure/series.repository.js";
import { SeriesLifecycleService } from "./series-lifecycle.service.js";

const log = createLogger("series.purge-reconciler");

@Injectable()
export class SeriesPurgeReconciler {
  private isRunning = false;

  constructor(
    private readonly seriesRepository: SeriesRepository,
    private readonly lifecycleService: SeriesLifecycleService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep(): Promise<void> {
    if (this.isRunning) {
      log.warn("series purge reconciliation still running, skipping this tick");
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
      candidates = await this.seriesRepository.findPurgeCandidates({
        deletedBefore,
        limit: SERIES_PURGE_RECONCILE_BATCH,
      });
    } catch (error) {
      log.error({ err: error }, "series purge reconciliation failed to load candidates");
      return;
    }

    if (candidates.length === 0) {
      return;
    }

    const purgedIds: string[] = [];
    for (const candidate of candidates) {
      try {
        await this.lifecycleService.purge({ seriesId: candidate.id, userId: candidate.userId });
        purgedIds.push(candidate.id);
      } catch (error) {
        log.error(
          { err: error, seriesId: candidate.id },
          "series purge reconciliation failed for series",
        );
      }
    }

    if (purgedIds.length > 0) {
      log.info(
        { count: purgedIds.length, seriesIds: purgedIds },
        "reconciled overdue series purges",
      );
    }
  }
}
