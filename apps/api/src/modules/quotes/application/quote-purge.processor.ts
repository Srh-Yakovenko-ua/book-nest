import type { Job } from "bullmq";

import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";

import { createLogger } from "../../../core/logger.js";
import { workerConnection } from "../../../core/queue/queue.module.js";
import { QUOTE_PURGE_QUEUE_NAME, QuotePurgeJobSchema } from "../domain/quote-purge.js";
import { QuoteLifecycleService } from "./quote-lifecycle.service.js";

const log = createLogger("quotes.purge-processor");

@Processor(QUOTE_PURGE_QUEUE_NAME, { connection: workerConnection })
export class QuotePurgeProcessor extends WorkerHost {
  constructor(private readonly lifecycleService: QuoteLifecycleService) {
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
      "quote purge job failed",
    );
  }

  async process(job: Job<unknown>): Promise<void> {
    const command = QuotePurgeJobSchema.parse(job.data);
    await this.lifecycleService.purge(command);
  }
}
