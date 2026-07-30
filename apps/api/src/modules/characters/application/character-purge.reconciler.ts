import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import type { PurgeReconciler } from "../../../core/purge-reconciler.js";

import { createPurgeReconciler } from "../../../core/purge-reconciler.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { CharactersRepository } from "../infrastructure/characters.repository.js";
import { CharacterLifecycleService } from "./character-lifecycle.service.js";

@Injectable()
export class CharacterPurgeReconciler {
  private readonly reconciler: PurgeReconciler;

  constructor(
    charactersRepository: CharactersRepository,
    lifecycleService: CharacterLifecycleService,
  ) {
    this.reconciler = createPurgeReconciler({
      batchSize: TRASH_RETENTION.reconcileBatchSize,
      findCandidates: (args) => charactersRepository.findPurgeCandidates(args),
      purge: ({ id, userId }) => lifecycleService.purge({ characterId: id, userId }),
      scope: "characters",
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  sweep(): Promise<void> {
    return this.reconciler.sweep();
  }
}
