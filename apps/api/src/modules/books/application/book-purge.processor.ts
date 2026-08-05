import type { Job } from "bullmq";

import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";

import { createLogger } from "../../../core/logger.js";
import { workerConnection } from "../../../core/queue/queue.module.js";
import { BOOK_PURGE_QUEUE_NAME, BookPurgeJobSchema } from "../domain/book-purge.js";
import { BookLifecycleService } from "./book-lifecycle.service.js";

const log = createLogger("books.purge-processor");

@Processor(BOOK_PURGE_QUEUE_NAME, { connection: workerConnection })
export class BookPurgeProcessor extends WorkerHost {
  constructor(private readonly lifecycleService: BookLifecycleService) {
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
      "book purge job failed",
    );
  }

  async process(job: Job<unknown>): Promise<void> {
    const command = BookPurgeJobSchema.parse(job.data);
    await this.lifecycleService.purge(command);
  }
}
