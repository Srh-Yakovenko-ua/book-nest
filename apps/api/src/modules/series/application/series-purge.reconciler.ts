import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import type { PurgeReconciler } from "../../../core/purge-reconciler.js";

import { createPurgeReconciler } from "../../../core/purge-reconciler.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { SeriesRepository } from "../infrastructure/series.repository.js";
import { SeriesLifecycleService } from "./series-lifecycle.service.js";

@Injectable()
export class SeriesPurgeReconciler {
  private readonly reconciler: PurgeReconciler;

  constructor(seriesRepository: SeriesRepository, lifecycleService: SeriesLifecycleService) {
    this.reconciler = createPurgeReconciler({
      batchSize: TRASH_RETENTION.reconcileBatchSize,
      findCandidates: (args) => seriesRepository.findPurgeCandidates(args),
      purge: ({ id, userId }) => lifecycleService.purge({ seriesId: id, userId }),
      scope: "series",
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  sweep(): Promise<void> {
    return this.reconciler.sweep();
  }
}
