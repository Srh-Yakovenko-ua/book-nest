import type { Job } from "bullmq";

import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";

import { createLogger } from "../../../core/logger.js";
import { workerConnection } from "../../../core/queue/queue.module.js";
import { TIMELINE_PURGE_QUEUE_NAME, TimelinePurgeJobSchema } from "../domain/timeline-purge.js";
import { TimelineLifecycleService } from "./timeline-lifecycle.service.js";

const log = createLogger("timeline.purge-processor");

@Processor(TIMELINE_PURGE_QUEUE_NAME, { connection: workerConnection })
export class TimelinePurgeProcessor extends WorkerHost {
  constructor(private readonly lifecycleService: TimelineLifecycleService) {
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
      "timeline purge job failed",
    );
  }

  async process(job: Job<unknown>): Promise<void> {
    const command = TimelinePurgeJobSchema.parse(job.data);
    await this.lifecycleService.purge(command);
  }
}
