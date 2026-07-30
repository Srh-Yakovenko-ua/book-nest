import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import type { PurgeReconciler } from "../../../core/purge-reconciler.js";

import { createPurgeReconciler } from "../../../core/purge-reconciler.js";
import { TimelineRepository } from "../infrastructure/timeline.repository.js";
import { TimelineLifecycleService } from "./timeline-lifecycle.service.js";

@Injectable()
export class TimelinePurgeReconciler {
  private readonly reconciler: PurgeReconciler;

  constructor(timelineRepository: TimelineRepository, lifecycleService: TimelineLifecycleService) {
    this.reconciler = createPurgeReconciler({
      findCandidates: (args) => timelineRepository.findPurgeCandidates(args),
      purge: ({ id, userId }) => lifecycleService.purge({ timelineId: id, userId }),
      scope: "timeline",
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  sweep(): Promise<void> {
    return this.reconciler.sweep();
  }
}
