import type { NotificationChannel, NotificationDeliveryStatus, Nullable } from "@app/shared";

import { NotificationChannelSchema, NotificationDeliveryStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { maskEmailsInText } from "../../mail/index.js";

const LAST_ERROR_MAX = 500;

const EMAIL_CHANNEL = NotificationChannelSchema.enum.email satisfies NotificationChannel;
const CLAIMED_STATUS = NotificationDeliveryStatusSchema.enum
  .claimed satisfies NotificationDeliveryStatus;
const PENDING_STATUS = NotificationDeliveryStatusSchema.enum
  .pending satisfies NotificationDeliveryStatus;
const SENT_STATUS = NotificationDeliveryStatusSchema.enum.sent satisfies NotificationDeliveryStatus;

const pendingEmailArgs = {
  select: {
    attempts: true,
    id: true,
    notification: { select: { id: true, params: true, type: true } },
  },
} satisfies Prisma.NotificationDeliveryDefaultArgs;

const digestRecipientArgs = {
  select: {
    email: true,
    emailVerifiedAt: true,
    name: true,
    settings: { select: { language: true } },
  },
} satisfies Prisma.UserDefaultArgs;

const claimedDeliveryArgs = {
  select: { attempts: true, id: true },
} satisfies Prisma.NotificationDeliveryDefaultArgs;

export type ClaimedEmailDelivery = Prisma.NotificationDeliveryGetPayload<
  typeof claimedDeliveryArgs
>;

export type DigestRecipientRow = Prisma.UserGetPayload<typeof digestRecipientArgs>;

export type PendingEmailDelivery = Prisma.NotificationDeliveryGetPayload<typeof pendingEmailArgs>;

type ClaimInput = {
  ids: string[];
  maxAttempts: number;
  reclaimBefore: Date;
};

type MarkFailedInput = {
  failedAt: Date;
  ids: string[];
  lastError: string;
  status: Extract<NotificationDeliveryStatus, "failed" | "pending">;
};

type PendingDeliveryLookupInput = {
  limit: number;
  maxAttempts: number;
  reclaimBefore: Date;
  userId: string;
};

type PendingRecipientLookupInput = {
  afterUserId: Nullable<string>;
  limit: number;
  maxAttempts: number;
  reclaimBefore: Date;
};

type SendableStatusFilter = Nullable<
  (reclaimBefore: Date) => Prisma.NotificationDeliveryWhereInput
>;

@Injectable()
export class NotificationDeliveriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  claimForSend(
    { ids, maxAttempts, reclaimBefore }: ClaimInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<ClaimedEmailDelivery[]> {
    return client.notificationDelivery.updateManyAndReturn({
      data: { attempts: { increment: 1 }, status: CLAIMED_STATUS },
      select: claimedDeliveryArgs.select,
      where: { id: { in: ids }, ...sendableStatus(reclaimBefore), attempts: { lt: maxAttempts } },
    });
  }

  async createPendingEmail(
    { notificationId }: { notificationId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.notificationDelivery.createMany({
      data: [{ channel: EMAIL_CHANNEL, notificationId, status: PENDING_STATUS }],
      skipDuplicates: true,
    });
  }

  findPendingForUser(
    { limit, maxAttempts, reclaimBefore, userId }: PendingDeliveryLookupInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<PendingEmailDelivery[]> {
    return client.notificationDelivery.findMany({
      orderBy: { createdAt: "asc" },
      select: pendingEmailArgs.select,
      take: limit,
      where: {
        attempts: { lt: maxAttempts },
        channel: EMAIL_CHANNEL,
        notification: { userId },
        ...sendableStatus(reclaimBefore),
      },
    });
  }

  async findPendingRecipientIds(
    { afterUserId, limit, maxAttempts, reclaimBefore }: PendingRecipientLookupInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<string[]> {
    const rows = await client.notification.groupBy({
      by: ["userId"],
      orderBy: { userId: "asc" },
      take: limit,
      where: {
        ...(afterUserId === null ? {} : { userId: { gt: afterUserId } }),
        deliveries: {
          some: {
            attempts: { lt: maxAttempts },
            channel: EMAIL_CHANNEL,
            ...sendableStatus(reclaimBefore),
          },
        },
      },
    });
    return rows.map((row) => row.userId);
  }

  findRecipient(
    { userId }: { userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<DigestRecipientRow>> {
    return client.user.findUnique({ select: digestRecipientArgs.select, where: { id: userId } });
  }

  async markFailed(
    { failedAt, ids, lastError, status }: MarkFailedInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.notificationDelivery.updateMany({
      data: { failedAt, lastError: toStoredLastError(lastError), status },
      where: { id: { in: ids }, status: CLAIMED_STATUS },
    });
  }

  async markSent(
    { ids, sentAt }: { ids: string[]; sentAt: Date },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.notificationDelivery.updateMany({
      data: { sentAt, status: SENT_STATUS },
      where: { id: { in: ids }, status: CLAIMED_STATUS },
    });
  }
}

const SENDABLE_STATUS_FILTERS = {
  claimed: (reclaimBefore: Date) => ({ status: CLAIMED_STATUS, updatedAt: { lt: reclaimBefore } }),
  failed: null,
  pending: () => ({ status: PENDING_STATUS }),
  sent: null,
} as const satisfies Record<NotificationDeliveryStatus, SendableStatusFilter>;

function sendableStatus(reclaimBefore: Date): Prisma.NotificationDeliveryWhereInput {
  const matches: Prisma.NotificationDeliveryWhereInput[] = [];
  for (const buildFilter of Object.values(SENDABLE_STATUS_FILTERS)) {
    if (buildFilter !== null) {
      matches.push(buildFilter(reclaimBefore));
    }
  }
  return { OR: matches };
}

function toStoredLastError(message: string): string {
  return maskEmailsInText(message).slice(0, LAST_ERROR_MAX);
}
