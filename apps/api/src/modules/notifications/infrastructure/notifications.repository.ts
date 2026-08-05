import type {
  NotificationEntityType,
  NotificationLevel,
  NotificationReason,
  NotificationType,
  Nullable,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { NotificationModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

export type NotificationCursor = {
  createdAt: Date;
  id: string;
};

type EntityDeletionRow = {
  deletedAt: Nullable<Date>;
  id: string;
};

type FindPageInput = {
  cursor: Nullable<NotificationCursor>;
  limit: number;
  unreadOnly: boolean;
  userId: string;
};

type MarkReadInput = {
  ids: string[];
  readAt: Date;
  userId: string;
};

type UpsertNotificationData = {
  dedupeKey: string;
  entityId: Nullable<string>;
  entityType: Nullable<NotificationEntityType>;
  level: NotificationLevel;
  params: Prisma.InputJsonValue;
  reason: NotificationReason;
  resetsReadState: boolean;
  type: NotificationType;
  userId: string;
};

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  countUnread(
    { userId }: { userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return client.notification.count({ where: { readAt: null, userId } });
  }

  findBookDeletionStates(
    { ids, userId }: { ids: string[]; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<EntityDeletionRow[]> {
    return client.book.findMany({
      select: { deletedAt: true, id: true },
      where: { id: { in: ids }, userId },
    });
  }

  findByIdForUser(
    { id, userId }: { id: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<NotificationCursor>> {
    return client.notification.findFirst({
      select: { createdAt: true, id: true },
      where: { id, userId },
    });
  }

  findPage(
    { cursor, limit, unreadOnly, userId }: FindPageInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<NotificationModel[]> {
    return client.notification.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      where: {
        userId,
        ...(unreadOnly ? { readAt: null } : {}),
        ...(cursor === null ? {} : beforeCursor(cursor)),
      },
    });
  }

  findPurgeCandidates(
    { createdBefore, limit }: { createdBefore: Date; limit: number },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<{ id: string; userId: string }[]> {
    return client.notification.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, userId: true },
      take: limit,
      where: { createdAt: { lt: createdBefore } },
    });
  }

  async hardDelete(
    { id }: { id: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.notification.deleteMany({ where: { id } });
  }

  async markAllRead(
    { readAt, userId }: { readAt: Date; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.notification.updateMany({
      data: { readAt },
      where: { readAt: null, userId },
    });
  }

  async markRead(
    { ids, readAt, userId }: MarkReadInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.notification.updateMany({
      data: { readAt },
      where: { id: { in: ids }, readAt: null, userId },
    });
  }

  upsertByDedupeKey(
    data: UpsertNotificationData,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<NotificationModel> {
    return client.notification.upsert({
      create: {
        dedupeKey: data.dedupeKey,
        entityId: data.entityId,
        entityType: data.entityType,
        level: data.level,
        params: data.params,
        reason: data.reason,
        type: data.type,
        userId: data.userId,
      },
      update: {
        params: data.params,
        ...(data.resetsReadState ? { readAt: null } : {}),
      },
      where: { userId_dedupeKey: { dedupeKey: data.dedupeKey, userId: data.userId } },
    });
  }
}

function beforeCursor(cursor: NotificationCursor): Prisma.NotificationWhereInput {
  return {
    createdAt: { lte: cursor.createdAt },
    OR: [{ createdAt: { lt: cursor.createdAt } }, { id: { lt: cursor.id } }],
  };
}
