import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { subMinutes } from "date-fns";

import type { ExclusiveTask } from "../../../core/exclusive-task.js";
import type { ClaimedDelivery, RenderableDelivery } from "../domain/renderable-delivery.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { createExclusiveTask } from "../../../core/exclusive-task.js";
import { scanByKeyset } from "../../../core/keyset-scan.js";
import { createLogger } from "../../../core/logger.js";
import { MailService } from "../../mail/index.js";
import { resolveRecipientLocale } from "../domain/recipient-locale.js";
import { partitionRenderableDeliveries } from "../domain/renderable-delivery.js";
import { NotificationDeliveriesRepository } from "../infrastructure/notification-deliveries.repository.js";

const NOTIFICATION_EMAIL_DISPATCH = {
  backstopCron: "30 * * * *",
  maxAttempts: 3,
  maxRecipientPages: 50,
  recipientPageSize: 100,
  staleClaimMinutes: 15,
  userDeliveryBatchSize: 50,
} as const;

const DISPATCH_SCOPE = "notifications.email-dispatcher";
const UNRENDERABLE_PAYLOAD_ERROR = "Stored notification payload does not match its type";
const UNVERIFIED_RECIPIENT_ERROR = "Recipient has no verified email address";

const log = createLogger(DISPATCH_SCOPE);

@Injectable()
export class NotificationEmailDispatcher {
  private readonly runBackstopExclusively: ExclusiveTask;

  constructor(
    private readonly deliveriesRepository: NotificationDeliveriesRepository,
    private readonly mailService: MailService,
    private readonly transactionRunner: TransactionRunner,
  ) {
    this.runBackstopExclusively = createExclusiveTask({
      run: () => this.dispatchPendingSafely(),
      scope: DISPATCH_SCOPE,
    });
  }

  async dispatchForUser({ userId }: { userId: string }): Promise<void> {
    const now = new Date();
    const claimed = await this.claimForUser({ now, userId });
    if (claimed.length === 0) {
      return;
    }

    const renderable = await this.dropUnrenderable({ claimed, userId });
    if (renderable.length === 0) {
      return;
    }

    const recipient = await this.deliveriesRepository.findRecipient({ userId });
    if (recipient === null || recipient.emailVerifiedAt === null) {
      await this.recordFailure({ deliveries: renderable, lastError: UNVERIFIED_RECIPIENT_ERROR });
      return;
    }

    try {
      await this.mailService.sendNotificationDigestEmailOrThrow({
        items: renderable.map((delivery) => delivery.payload),
        locale: resolveRecipientLocale(recipient.settings?.language ?? null),
        to: recipient.email,
        userName: recipient.name,
      });
    } catch (error) {
      await this.recordFailure({ deliveries: renderable, lastError: toErrorMessage(error) });
      return;
    }

    await this.deliveriesRepository.markSent({
      ids: renderable.map((delivery) => delivery.id),
      sentAt: new Date(),
    });
  }

  async dispatchPending(): Promise<void> {
    await scanByKeyset<string>({
      loadPage: (afterUserId) =>
        this.deliveriesRepository.findPendingRecipientIds({
          afterUserId,
          limit: NOTIFICATION_EMAIL_DISPATCH.recipientPageSize,
          maxAttempts: NOTIFICATION_EMAIL_DISPATCH.maxAttempts,
          reclaimBefore: reclaimCutoff(new Date()),
        }),
      maxPages: NOTIFICATION_EMAIL_DISPATCH.maxRecipientPages,
      pageSize: NOTIFICATION_EMAIL_DISPATCH.recipientPageSize,
      scope: DISPATCH_SCOPE,
      toCursor: (userId) => userId,
      visitPage: (userIds) => this.dispatchToRecipients(userIds),
    });
  }

  @Cron(NOTIFICATION_EMAIL_DISPATCH.backstopCron)
  runBackstop(): Promise<void> {
    return this.runBackstopExclusively();
  }

  private async claimForUser({
    now,
    userId,
  }: {
    now: Date;
    userId: string;
  }): Promise<ClaimedDelivery[]> {
    const reclaimBefore = reclaimCutoff(now);
    const pending = await this.deliveriesRepository.findPendingForUser({
      limit: NOTIFICATION_EMAIL_DISPATCH.userDeliveryBatchSize,
      maxAttempts: NOTIFICATION_EMAIL_DISPATCH.maxAttempts,
      reclaimBefore,
      userId,
    });

    if (pending.length === 0) {
      return [];
    }

    const claimed = await this.deliveriesRepository.claimForSend({
      ids: pending.map((delivery) => delivery.id),
      maxAttempts: NOTIFICATION_EMAIL_DISPATCH.maxAttempts,
      reclaimBefore,
    });
    const attemptsById = new Map(claimed.map((row) => [row.id, row.attempts]));

    return pending.flatMap((delivery) => {
      const attempts = attemptsById.get(delivery.id);
      return attempts === undefined ? [] : [{ attempts, delivery }];
    });
  }

  private async dispatchPendingSafely(): Promise<void> {
    try {
      await this.dispatchPending();
    } catch (error) {
      log.error({ err: error }, "notification digest backstop failed");
    }
  }

  private async dispatchToRecipients(userIds: readonly string[]): Promise<void> {
    for (const userId of userIds) {
      try {
        await this.dispatchForUser({ userId });
      } catch (error) {
        log.error({ err: error, userId }, "notification digest dispatch failed");
      }
    }
  }

  private async dropUnrenderable({
    claimed,
    userId,
  }: {
    claimed: ClaimedDelivery[];
    userId: string;
  }): Promise<RenderableDelivery[]> {
    const { renderable, unrenderable } = partitionRenderableDeliveries(claimed);

    if (unrenderable.length === 0) {
      return renderable;
    }

    for (const delivery of unrenderable) {
      log.warn(
        { deliveryId: delivery.id, notificationId: delivery.notification.id, userId },
        "dropped a notification whose stored payload does not match its type",
      );
    }
    await this.deliveriesRepository.markFailed({
      failedAt: new Date(),
      ids: unrenderable.map((delivery) => delivery.id),
      lastError: UNRENDERABLE_PAYLOAD_ERROR,
      status: "failed",
    });

    return renderable;
  }

  private async recordFailure({
    deliveries,
    lastError,
  }: {
    deliveries: RenderableDelivery[];
    lastError: string;
  }): Promise<void> {
    const exhaustedIds = deliveries
      .filter((delivery) => delivery.attempts >= NOTIFICATION_EMAIL_DISPATCH.maxAttempts)
      .map((delivery) => delivery.id);
    const retryableIds = deliveries
      .filter((delivery) => delivery.attempts < NOTIFICATION_EMAIL_DISPATCH.maxAttempts)
      .map((delivery) => delivery.id);
    const failedAt = new Date();

    await this.transactionRunner.run(async (tx) => {
      if (retryableIds.length > 0) {
        await this.deliveriesRepository.markFailed(
          { failedAt, ids: retryableIds, lastError, status: "pending" },
          tx,
        );
      }
      if (exhaustedIds.length > 0) {
        await this.deliveriesRepository.markFailed(
          { failedAt, ids: exhaustedIds, lastError, status: "failed" },
          tx,
        );
      }
    });
  }
}

function reclaimCutoff(now: Date): Date {
  return subMinutes(now, NOTIFICATION_EMAIL_DISPATCH.staleClaimMinutes);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
