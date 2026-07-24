import type { ConnectionOptions, QueueOptions } from "bullmq";

import { BullModule } from "@nestjs/bullmq";
import { Global, Module } from "@nestjs/common";

import { env } from "../../config/env.js";

const JOB_ATTEMPTS = 3;
const BACKOFF_DELAY_MS = 1000;
const KEEP_LAST_FAILED_JOBS = 100;

export const workerConnection: ConnectionOptions = {
  maxRetriesPerRequest: null,
  url: env.redisUrl,
};

const queueConfig: QueueOptions = {
  connection: {
    enableOfflineQueue: false,
    maxRetriesPerRequest: null,
    url: env.redisUrl,
  },
  defaultJobOptions: {
    attempts: JOB_ATTEMPTS,
    backoff: { delay: BACKOFF_DELAY_MS, type: "exponential" },
    removeOnComplete: true,
    removeOnFail: { count: KEEP_LAST_FAILED_JOBS },
  },
};

@Global()
@Module({
  exports: [BullModule],
  imports: [BullModule.forRoot(queueConfig)],
})
export class QueueModule {}
