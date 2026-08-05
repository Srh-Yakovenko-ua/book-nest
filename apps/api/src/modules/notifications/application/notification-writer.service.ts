import type { Queue } from "bullmq";

import { NOTIFICATION_LEVEL_BY_TYPE } from "@app/shared";
import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { isEqual } from "date-fns";

import type { NotificationDraft } from "../domain/notification-draft.js";
import type { NotificationEmailJob } from "../domain/notification-email.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { createLogger } from "../../../core/logger.js";
import { toIsoHour } from "../domain/notification-dedupe.js";
import {
  buildNotificationEmailJobId,
  NOTIFICATION_EMAIL_JOB,
  NOTIFICATION_EMAIL_QUEUE_NAME,
} from "../domain/notification-email.js";
import { toStoredNotificationParams } from "../domain/notification.mapper.js";
import { NotificationDeliveriesRepository } from "../infrastructure/notification-deliveries.repository.js";
import { NotificationsRepository } from "../infrastructure/notifications.repository.js";

const log = createLogger("notifications.writer");

type WriteNotificationInput = {
  emailPreferenceEnabled: boolean;
  emailVerified: boolean;
  notification: NotificationDraft;
  userId: string;
};

type WriteNotificationResult = {
  emailDeliveryCreated: boolean;
};

@Injectable()
export class NotificationWriterService {
  constructor(
    private readonly deliveriesRepository: NotificationDeliveriesRepository,
    private readonly notificationsRepository: NotificationsRepository,
    private readonly transactionRunner: TransactionRunner,
    @InjectQueue(NOTIFICATION_EMAIL_QUEUE_NAME)
    private readonly emailQueue: Queue<NotificationEmailJob>,
  ) {}

  async enqueueDigest({ now, userId }: { now: Date; userId: string }): Promise<void> {
    try {
      await this.emailQueue.add(
        NOTIFICATION_EMAIL_JOB,
        { userId },
        { jobId: buildNotificationEmailJobId({ isoHour: toIsoHour(now), userId }) },
      );
    } catch (error) {
      log.warn({ err: error, userId }, "failed to enqueue the notification digest job");
    }
  }

  write({
    emailPreferenceEnabled,
    emailVerified,
    notification,
    userId,
  }: WriteNotificationInput): Promise<WriteNotificationResult> {
    const emailRequested = emailPreferenceEnabled && emailVerified;

    return this.transactionRunner.run(async (tx) => {
      const row = await this.notificationsRepository.upsertByDedupeKey(
        {
          dedupeKey: notification.dedupeKey,
          entityId: notification.entityId,
          entityType: notification.entityType,
          level: NOTIFICATION_LEVEL_BY_TYPE[notification.payload.type],
          params: toStoredNotificationParams(notification.payload),
          reason: notification.reason,
          resetsReadState: notification.resetsReadState,
          type: notification.payload.type,
          userId,
        },
        tx,
      );

      const isCreated = isEqual(row.createdAt, row.updatedAt);
      if (!isCreated || !emailRequested) {
        return { emailDeliveryCreated: false };
      }

      await this.deliveriesRepository.createPendingEmail({ notificationId: row.id }, tx);
      return { emailDeliveryCreated: true };
    });
  }
}
