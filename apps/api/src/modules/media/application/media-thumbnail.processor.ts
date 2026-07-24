import type { Job } from "bullmq";

import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";

import { createLogger } from "../../../core/logger.js";
import { workerConnection } from "../../../core/queue/queue.module.js";
import { GenerateThumbJobSchema, MEDIA_QUEUE_NAME } from "../domain/media-queue.js";
import { MediaService } from "./media.service.js";

const log = createLogger("media.thumbnail-processor");

@Processor(MEDIA_QUEUE_NAME, { connection: workerConnection })
export class MediaThumbnailProcessor extends WorkerHost {
  constructor(private readonly mediaService: MediaService) {
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
      "media thumbnail job failed",
    );
  }

  async process(job: Job<unknown>): Promise<void> {
    const command = GenerateThumbJobSchema.parse(job.data);
    await this.mediaService.generateThumbnail(command);
  }
}
