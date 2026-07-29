import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { createLogger } from "../../../core/logger.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { TIMELINE_PURGE_RECONCILE_BATCH } from "../domain/timeline-purge.js";
import { TimelineRepository } from "../infrastructure/timeline.repository.js";
import { TimelineLifecycleService } from "./timeline-lifecycle.service.js";

const log = createLogger("timeline.purge-reconciler");

@Injectable()
export class TimelinePurgeReconciler {
  private isRunning = false;

  constructor(
    private readonly timelineRepository: TimelineRepository,
    private readonly lifecycleService: TimelineLifecycleService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep(): Promise<void> {
    if (this.isRunning) {
      log.warn("timeline purge reconciliation still running, skipping this tick");
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
      candidates = await this.timelineRepository.findPurgeCandidates({
        deletedBefore,
        limit: TIMELINE_PURGE_RECONCILE_BATCH,
      });
    } catch (error) {
      log.error({ err: error }, "timeline purge reconciliation failed to load candidates");
      return;
    }

    if (candidates.length === 0) {
      return;
    }

    const purgedIds: string[] = [];
    for (const candidate of candidates) {
      try {
        await this.lifecycleService.purge({ timelineId: candidate.id, userId: candidate.userId });
        purgedIds.push(candidate.id);
      } catch (error) {
        log.error(
          { err: error, timelineId: candidate.id },
          "timeline purge reconciliation failed for timeline",
        );
      }
    }

    if (purgedIds.length > 0) {
      log.info(
        { count: purgedIds.length, timelineIds: purgedIds },
        "reconciled overdue timeline purges",
      );
    }
  }
}
