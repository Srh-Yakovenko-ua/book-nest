import type { Job } from "bullmq";

import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";

import { createLogger } from "../../../core/logger.js";
import { workerConnection } from "../../../core/queue/queue.module.js";
import {
  NOTIFICATION_EMAIL_QUEUE_NAME,
  NotificationEmailJobSchema,
} from "../domain/notification-email.js";
import { NotificationEmailDispatcher } from "./notification-email.dispatcher.js";

const log = createLogger("notifications.email-processor");

@Processor(NOTIFICATION_EMAIL_QUEUE_NAME, { connection: workerConnection })
export class NotificationEmailProcessor extends WorkerHost {
  constructor(private readonly dispatcher: NotificationEmailDispatcher) {
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
      "notification digest job failed",
    );
  }

  async process(job: Job<unknown>): Promise<void> {
    const command = NotificationEmailJobSchema.parse(job.data);
    await this.dispatcher.dispatchForUser(command);
  }
}
