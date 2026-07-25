import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { subMilliseconds } from "date-fns";

import { createLogger } from "../../../core/logger.js";
import {
  CHARACTER_PURGE_RECONCILE_BATCH,
  CHARACTER_PURGE_WINDOW_MS,
} from "../domain/character-purge.js";
import { CharactersRepository } from "../infrastructure/characters.repository.js";
import { CharacterLifecycleService } from "./character-lifecycle.service.js";

const log = createLogger("characters.purge-reconciler");

@Injectable()
export class CharacterPurgeReconciler {
  private isRunning = false;

  constructor(
    private readonly charactersRepository: CharactersRepository,
    private readonly lifecycleService: CharacterLifecycleService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep(): Promise<void> {
    if (this.isRunning) {
      log.warn("character purge reconciliation still running, skipping this tick");
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
    const deletedBefore = subMilliseconds(new Date(), CHARACTER_PURGE_WINDOW_MS);

    let candidates: { id: string; userId: string }[];
    try {
      candidates = await this.charactersRepository.findPurgeCandidates({
        deletedBefore,
        limit: CHARACTER_PURGE_RECONCILE_BATCH,
      });
    } catch (error) {
      log.error({ err: error }, "character purge reconciliation failed to load candidates");
      return;
    }

    if (candidates.length === 0) {
      return;
    }

    const purgedIds: string[] = [];
    for (const candidate of candidates) {
      try {
        await this.lifecycleService.purge({
          characterId: candidate.id,
          userId: candidate.userId,
        });
        purgedIds.push(candidate.id);
      } catch (error) {
        log.error(
          { characterId: candidate.id, err: error },
          "character purge reconciliation failed for character",
        );
      }
    }

    if (purgedIds.length > 0) {
      log.info(
        { characterIds: purgedIds, count: purgedIds.length },
        "reconciled overdue character purges",
      );
    }
  }
}
