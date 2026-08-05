import type { Job } from "bullmq";

import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";

import { createLogger } from "../../../core/logger.js";
import { workerConnection } from "../../../core/queue/queue.module.js";
import { SERIES_PURGE_QUEUE_NAME, SeriesPurgeJobSchema } from "../domain/series-purge.js";
import { SeriesLifecycleService } from "./series-lifecycle.service.js";

const log = createLogger("series.purge-processor");

@Processor(SERIES_PURGE_QUEUE_NAME, { connection: workerConnection })
export class SeriesPurgeProcessor extends WorkerHost {
  constructor(private readonly lifecycleService: SeriesLifecycleService) {
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
      "series purge job failed",
    );
  }

  async process(job: Job<unknown>): Promise<void> {
    const command = SeriesPurgeJobSchema.parse(job.data);
    await this.lifecycleService.purge(command);
  }
}
