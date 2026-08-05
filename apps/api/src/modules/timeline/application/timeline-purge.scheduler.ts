import type { Queue } from "bullmq";

import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";

import { createLogger } from "../../../core/logger.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import {
  TIMELINE_PURGE_JOB,
  TIMELINE_PURGE_QUEUE_NAME,
  type TimelinePurgeJob,
} from "../domain/timeline-purge.js";

const log = createLogger("timeline.purge-scheduler");

@Injectable()
export class TimelinePurgeScheduler {
  constructor(
    @InjectQueue(TIMELINE_PURGE_QUEUE_NAME)
    private readonly purgeQueue: Queue<TimelinePurgeJob>,
  ) {}

  async cancel(timelineId: string): Promise<void> {
    try {
      await this.purgeQueue.remove(timelineId);
    } catch (error) {
      log.warn({ err: error, timelineId }, "failed to cancel timeline purge job");
    }
  }

  async schedule({ timelineId, userId }: TimelinePurgeJob): Promise<void> {
    try {
      await this.purgeQueue.remove(timelineId);
      await this.purgeQueue.add(
        TIMELINE_PURGE_JOB,
        { timelineId, userId },
        { delay: TRASH_RETENTION.purgeDelayMs, jobId: timelineId },
      );
    } catch (error) {
      log.warn({ err: error, timelineId }, "failed to enqueue timeline purge job");
    }
  }
}
