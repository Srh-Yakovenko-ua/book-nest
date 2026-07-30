import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import type { PurgeReconciler } from "../../../core/purge-reconciler.js";

import { createPurgeReconciler } from "../../../core/purge-reconciler.js";
import { ListsRepository } from "../infrastructure/lists.repository.js";
import { ListLifecycleService } from "./list-lifecycle.service.js";

@Injectable()
export class ListPurgeReconciler {
  private readonly reconciler: PurgeReconciler;

  constructor(listsRepository: ListsRepository, lifecycleService: ListLifecycleService) {
    this.reconciler = createPurgeReconciler({
      findCandidates: (args) => listsRepository.findPurgeCandidates(args),
      purge: ({ id, userId }) => lifecycleService.purge({ listId: id, userId }),
      scope: "lists",
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  sweep(): Promise<void> {
    return this.reconciler.sweep();
  }
}
