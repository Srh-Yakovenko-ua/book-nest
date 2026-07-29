import type { Job } from "bullmq";

import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";

import { createLogger } from "../../../core/logger.js";
import { workerConnection } from "../../../core/queue/queue.module.js";
import { NOTE_PURGE_QUEUE_NAME, NotePurgeJobSchema } from "../domain/note-purge.js";
import { NoteLifecycleService } from "./note-lifecycle.service.js";

const log = createLogger("notes.purge-processor");

@Processor(NOTE_PURGE_QUEUE_NAME, { connection: workerConnection })
export class NotePurgeProcessor extends WorkerHost {
  constructor(private readonly lifecycleService: NoteLifecycleService) {
    super();
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<unknown> | undefined, error: Error): void {
    log.error(
      {
        attemptsMade: job?.attemptsMade,
        err: error,
        jobId: job?.id,
        jobName: job?.name,
      },
      "note purge job failed",
    );
  }

  async process(job: Job<unknown>): Promise<void> {
    const command = NotePurgeJobSchema.parse(job.data);
    await this.lifecycleService.purge(command);
  }
}
