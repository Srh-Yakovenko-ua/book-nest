import type { Queue } from "bullmq";

import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";

import { createLogger } from "../../../core/logger.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { LIST_PURGE_JOB, LIST_PURGE_QUEUE_NAME, type ListPurgeJob } from "../domain/list-purge.js";

const log = createLogger("lists.purge-scheduler");

@Injectable()
export class ListPurgeScheduler {
  constructor(
    @InjectQueue(LIST_PURGE_QUEUE_NAME)
    private readonly purgeQueue: Queue<ListPurgeJob>,
  ) {}

  async cancel(listId: string): Promise<void> {
    try {
      await this.purgeQueue.remove(listId);
    } catch (error) {
      log.warn({ err: error, listId }, "failed to cancel list purge job");
    }
  }

  async schedule({ listId, userId }: ListPurgeJob): Promise<void> {
    try {
      await this.purgeQueue.remove(listId);
      await this.purgeQueue.add(
        LIST_PURGE_JOB,
        { listId, userId },
        { delay: TRASH_RETENTION.purgeDelayMs, jobId: listId },
      );
    } catch (error) {
      log.warn({ err: error, listId }, "failed to enqueue list purge job");
    }
  }
}
