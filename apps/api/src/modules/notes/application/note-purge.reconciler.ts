import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import type { PurgeReconciler } from "../../../core/purge-reconciler.js";

import { createPurgeReconciler } from "../../../core/purge-reconciler.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { NotesRepository } from "../infrastructure/notes.repository.js";
import { NoteLifecycleService } from "./note-lifecycle.service.js";

@Injectable()
export class NotePurgeReconciler {
  private readonly reconciler: PurgeReconciler;

  constructor(notesRepository: NotesRepository, lifecycleService: NoteLifecycleService) {
    this.reconciler = createPurgeReconciler({
      batchSize: TRASH_RETENTION.reconcileBatchSize,
      findCandidates: (args) => notesRepository.findPurgeCandidates(args),
      purge: ({ id, userId }) => lifecycleService.purge({ noteId: id, userId }),
      scope: "notes",
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  sweep(): Promise<void> {
    return this.reconciler.sweep();
  }
}
