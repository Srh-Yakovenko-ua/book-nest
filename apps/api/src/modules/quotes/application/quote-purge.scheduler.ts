import type { Queue } from "bullmq";

import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";

import { createLogger } from "../../../core/logger.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import {
  QUOTE_PURGE_JOB,
  QUOTE_PURGE_QUEUE_NAME,
  type QuotePurgeJob,
} from "../domain/quote-purge.js";

const log = createLogger("quotes.purge-scheduler");

@Injectable()
export class QuotePurgeScheduler {
  constructor(
    @InjectQueue(QUOTE_PURGE_QUEUE_NAME)
    private readonly purgeQueue: Queue<QuotePurgeJob>,
  ) {}

  async cancel(quoteId: string): Promise<void> {
    try {
      await this.purgeQueue.remove(quoteId);
    } catch (error) {
      log.warn({ err: error, quoteId }, "failed to cancel quote purge job");
    }
  }

  async schedule({ quoteId, userId }: QuotePurgeJob): Promise<void> {
    try {
      await this.purgeQueue.remove(quoteId);
      await this.purgeQueue.add(
        QUOTE_PURGE_JOB,
        { quoteId, userId },
        { delay: TRASH_RETENTION.purgeDelayMs, jobId: quoteId },
      );
    } catch (error) {
      log.warn({ err: error, quoteId }, "failed to enqueue quote purge job");
    }
  }
}
