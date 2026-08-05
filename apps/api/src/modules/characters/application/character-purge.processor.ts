import type { Job } from "bullmq";

import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";

import { createLogger } from "../../../core/logger.js";
import { workerConnection } from "../../../core/queue/queue.module.js";
import { CHARACTER_PURGE_QUEUE_NAME, CharacterPurgeJobSchema } from "../domain/character-purge.js";
import { CharacterLifecycleService } from "./character-lifecycle.service.js";

const log = createLogger("characters.purge-processor");

@Processor(CHARACTER_PURGE_QUEUE_NAME, { connection: workerConnection })
export class CharacterPurgeProcessor extends WorkerHost {
  constructor(private readonly lifecycleService: CharacterLifecycleService) {
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
      "character purge job failed",
    );
  }

  async process(job: Job<unknown>): Promise<void> {
    const command = CharacterPurgeJobSchema.parse(job.data);
    await this.lifecycleService.purge(command);
  }
}
