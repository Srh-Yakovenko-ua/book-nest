import type { Job } from "bullmq";

import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";

import { createLogger } from "../../../core/logger.js";
import { workerConnection } from "../../../core/queue/queue.module.js";
import { LIST_PURGE_QUEUE_NAME, ListPurgeJobSchema } from "../domain/list-purge.js";
import { ListLifecycleService } from "./list-lifecycle.service.js";

const log = createLogger("lists.purge-processor");

@Processor(LIST_PURGE_QUEUE_NAME, { connection: workerConnection })
export class ListPurgeProcessor extends WorkerHost {
  constructor(private readonly lifecycleService: ListLifecycleService) {
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
      "list purge job failed",
    );
  }

  async process(job: Job<unknown>): Promise<void> {
    const command = ListPurgeJobSchema.parse(job.data);
    await this.lifecycleService.purge(command);
  }
}
