import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { createLogger } from "../../../core/logger.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { LIST_PURGE_RECONCILE_BATCH } from "../domain/list-purge.js";
import { ListsRepository } from "../infrastructure/lists.repository.js";
import { ListLifecycleService } from "./list-lifecycle.service.js";

const log = createLogger("lists.purge-reconciler");

@Injectable()
export class ListPurgeReconciler {
  private isRunning = false;

  constructor(
    private readonly listsRepository: ListsRepository,
    private readonly lifecycleService: ListLifecycleService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep(): Promise<void> {
    if (this.isRunning) {
      log.warn("list purge reconciliation still running, skipping this tick");
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
      candidates = await this.listsRepository.findPurgeCandidates({
        deletedBefore,
        limit: LIST_PURGE_RECONCILE_BATCH,
      });
    } catch (error) {
      log.error({ err: error }, "list purge reconciliation failed to load candidates");
      return;
    }

    if (candidates.length === 0) {
      return;
    }

    const purgedIds: string[] = [];
    for (const candidate of candidates) {
      try {
        await this.lifecycleService.purge({ listId: candidate.id, userId: candidate.userId });
        purgedIds.push(candidate.id);
      } catch (error) {
        log.error(
          { err: error, listId: candidate.id },
          "list purge reconciliation failed for list",
        );
      }
    }

    if (purgedIds.length > 0) {
      log.info({ count: purgedIds.length, listIds: purgedIds }, "reconciled overdue list purges");
    }
  }
}
