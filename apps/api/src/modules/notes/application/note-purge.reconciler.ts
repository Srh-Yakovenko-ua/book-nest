import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import type { PurgeReconciler } from "../../../core/purge-reconciler.js";

import { createPurgeReconciler } from "../../../core/purge-reconciler.js";
import { NotesRepository } from "../infrastructure/notes.repository.js";
import { NoteLifecycleService } from "./note-lifecycle.service.js";

@Injectable()
export class NotePurgeReconciler {
  private readonly reconciler: PurgeReconciler;

  constructor(notesRepository: NotesRepository, lifecycleService: NoteLifecycleService) {
    this.reconciler = createPurgeReconciler({
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
