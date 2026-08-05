import type { Queue } from "bullmq";

import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";

import { createLogger } from "../../../core/logger.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import {
  SERIES_PURGE_JOB,
  SERIES_PURGE_QUEUE_NAME,
  type SeriesPurgeJob,
} from "../domain/series-purge.js";

const log = createLogger("series.purge-scheduler");

@Injectable()
export class SeriesPurgeScheduler {
  constructor(
    @InjectQueue(SERIES_PURGE_QUEUE_NAME)
    private readonly purgeQueue: Queue<SeriesPurgeJob>,
  ) {}

  async cancel(seriesId: string): Promise<void> {
    try {
      await this.purgeQueue.remove(seriesId);
    } catch (error) {
      log.warn({ err: error, seriesId }, "failed to cancel series purge job");
    }
  }

  async schedule({ seriesId, userId }: SeriesPurgeJob): Promise<void> {
    try {
      await this.purgeQueue.remove(seriesId);
      await this.purgeQueue.add(
        SERIES_PURGE_JOB,
        { seriesId, userId },
        { delay: TRASH_RETENTION.purgeDelayMs, jobId: seriesId },
      );
    } catch (error) {
      log.warn({ err: error, seriesId }, "failed to enqueue series purge job");
    }
  }
}
