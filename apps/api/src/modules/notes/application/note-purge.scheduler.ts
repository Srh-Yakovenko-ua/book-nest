import type { Queue } from "bullmq";

import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";

import { createLogger } from "../../../core/logger.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { NOTE_PURGE_JOB, NOTE_PURGE_QUEUE_NAME, type NotePurgeJob } from "../domain/note-purge.js";

const log = createLogger("notes.purge-scheduler");

@Injectable()
export class NotePurgeScheduler {
  constructor(
    @InjectQueue(NOTE_PURGE_QUEUE_NAME)
    private readonly purgeQueue: Queue<NotePurgeJob>,
  ) {}

  async cancel(noteId: string): Promise<void> {
    try {
      await this.purgeQueue.remove(noteId);
    } catch (error) {
      log.warn({ err: error, noteId }, "failed to cancel note purge job");
    }
  }

  async schedule({ noteId, userId }: NotePurgeJob): Promise<void> {
    try {
      await this.purgeQueue.remove(noteId);
      await this.purgeQueue.add(
        NOTE_PURGE_JOB,
        { noteId, userId },
        { delay: TRASH_RETENTION.purgeDelayMs, jobId: noteId },
      );
    } catch (error) {
      log.warn({ err: error, noteId }, "failed to enqueue note purge job");
    }
  }
}
