import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { createLogger } from "../../../core/logger.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { NOTE_PURGE_RECONCILE_BATCH } from "../domain/note-purge.js";
import { NotesRepository } from "../infrastructure/notes.repository.js";
import { NoteLifecycleService } from "./note-lifecycle.service.js";

const log = createLogger("notes.purge-reconciler");

@Injectable()
export class NotePurgeReconciler {
  private isRunning = false;

  constructor(
    private readonly notesRepository: NotesRepository,
    private readonly lifecycleService: NoteLifecycleService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sweep(): Promise<void> {
    if (this.isRunning) {
      log.warn("note purge reconciliation still running, skipping this tick");
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
      candidates = await this.notesRepository.findPurgeCandidates({
        deletedBefore,
        limit: NOTE_PURGE_RECONCILE_BATCH,
      });
    } catch (error) {
      log.error({ err: error }, "note purge reconciliation failed to load candidates");
      return;
    }

    if (candidates.length === 0) {
      return;
    }

    const purgedIds: string[] = [];
    for (const candidate of candidates) {
      try {
        await this.lifecycleService.purge({ noteId: candidate.id, userId: candidate.userId });
        purgedIds.push(candidate.id);
      } catch (error) {
        log.error(
          { err: error, noteId: candidate.id },
          "note purge reconciliation failed for note",
        );
      }
    }

    if (purgedIds.length > 0) {
      log.info({ count: purgedIds.length, noteIds: purgedIds }, "reconciled overdue note purges");
    }
  }
}
