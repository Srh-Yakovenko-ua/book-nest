import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { subDays } from "date-fns";

import type { PurgeReconciler } from "../../../core/purge-reconciler.js";

import { env } from "../../../config/env.js";
import { createPurgeReconciler } from "../../../core/purge-reconciler.js";
import { NotificationsRepository } from "../infrastructure/notifications.repository.js";

export const NOTIFICATION_RETENTION = {
  days: env.notificationRetentionDays,
  reconcileBatchSize: 100,
} as const;

@Injectable()
export class NotificationPurgeReconciler {
  private readonly reconciler: PurgeReconciler;

  constructor(notificationsRepository: NotificationsRepository) {
    this.reconciler = createPurgeReconciler({
      batchSize: NOTIFICATION_RETENTION.reconcileBatchSize,
      findCandidates: ({ limit, now }) =>
        notificationsRepository.findPurgeCandidates({
          createdBefore: subDays(now, NOTIFICATION_RETENTION.days),
          limit,
        }),
      purge: ({ id }) => notificationsRepository.hardDelete({ id }),
      scope: "notifications",
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  sweep(): Promise<void> {
    return this.reconciler.sweep();
  }
}
