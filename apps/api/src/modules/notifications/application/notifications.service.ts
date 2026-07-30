import type {
  NotificationLevel,
  NotificationListQuery,
  NotificationListResponse,
  NotificationReason,
  NotificationType,
  NotificationUnreadCount,
  NotificationView,
  Nullable,
} from "@app/shared";

import { NOTIFICATION_LEVEL_BY_TYPE, NOTIFICATION_TYPES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type {
  EntityDeletionLookup,
  NotificationEntityRef,
} from "../domain/notification-entity-state.js";
import type { NotificationCursor } from "../infrastructure/notifications.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { createLogger } from "../../../core/logger.js";
import { buildTestDedupeKey } from "../domain/notification-dedupe.js";
import {
  collectBookEntityIds,
  resolveNotificationEntityState,
} from "../domain/notification-entity-state.js";
import { type NotificationRow, toNotificationView } from "../domain/notification.mapper.js";
import { NotificationsRepository } from "../infrastructure/notifications.repository.js";

const CURSOR_NOT_FOUND_MESSAGE = "Notification cursor not found";

const MANUAL_TEST_NOTIFICATION = {
  level: NOTIFICATION_LEVEL_BY_TYPE[NOTIFICATION_TYPES.systemTest],
  reason: "manual_test",
  type: NOTIFICATION_TYPES.systemTest,
} as const satisfies {
  level: NotificationLevel;
  reason: NotificationReason;
  type: NotificationType;
};

const logger = createLogger("notifications.service");

type ListInput = {
  query: NotificationListQuery;
  userId: string;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly notificationsRepository: NotificationsRepository) {}

  async createTestNotification({ userId }: { userId: string }): Promise<void> {
    const requestedAt = new Date();

    await this.notificationsRepository.upsertByDedupeKey({
      dedupeKey: buildTestDedupeKey({ requestedAt, userId }),
      entityId: null,
      entityType: null,
      level: MANUAL_TEST_NOTIFICATION.level,
      params: { requestedAt: requestedAt.toISOString() },
      reason: MANUAL_TEST_NOTIFICATION.reason,
      resetsReadState: true,
      type: MANUAL_TEST_NOTIFICATION.type,
      userId,
    });
  }

  async list({ query, userId }: ListInput): Promise<NotificationListResponse> {
    const cursor = await this.resolveCursor({ cursor: query.cursor, userId });

    const rows = await this.notificationsRepository.findPage({
      cursor,
      limit: query.limit + 1,
      unreadOnly: query.unreadOnly,
      userId,
    });

    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;

    const [deletionLookup, unreadCount] = await Promise.all([
      this.loadDeletionLookup({ refs: pageRows, userId }),
      this.notificationsRepository.countUnread({ userId }),
    ]);

    const lastRow = pageRows.at(-1);

    return {
      items: this.toViews({ deletionLookup, rows: pageRows }),
      nextCursor: hasMore && lastRow !== undefined ? lastRow.id : null,
      unreadCount,
    };
  }

  async markAllRead({ userId }: { userId: string }): Promise<void> {
    await this.notificationsRepository.markAllRead({ readAt: new Date(), userId });
  }

  async markRead({ ids, userId }: { ids: string[]; userId: string }): Promise<void> {
    await this.notificationsRepository.markRead({ ids, readAt: new Date(), userId });
  }

  async unreadCount({ userId }: { userId: string }): Promise<NotificationUnreadCount> {
    return { unreadCount: await this.notificationsRepository.countUnread({ userId }) };
  }

  private async loadDeletionLookup({
    refs,
    userId,
  }: {
    refs: readonly NotificationEntityRef[];
    userId: string;
  }): Promise<EntityDeletionLookup> {
    const bookIds = collectBookEntityIds(refs);
    if (bookIds.length === 0) {
      return new Map();
    }

    const books = await this.notificationsRepository.findBookDeletionStates({
      ids: bookIds,
      userId,
    });
    return new Map(books.map((book) => [book.id, book.deletedAt]));
  }

  private async resolveCursor({
    cursor,
    userId,
  }: {
    cursor: string | undefined;
    userId: string;
  }): Promise<Nullable<NotificationCursor>> {
    if (cursor === undefined) {
      return null;
    }

    const anchor = await this.notificationsRepository.findByIdForUser({ id: cursor, userId });
    if (anchor === null) {
      throw new NotFoundError(CURSOR_NOT_FOUND_MESSAGE);
    }
    return anchor;
  }

  private toViews({
    deletionLookup,
    rows,
  }: {
    deletionLookup: EntityDeletionLookup;
    rows: readonly NotificationRow[];
  }): NotificationView[] {
    const views: NotificationView[] = [];

    for (const row of rows) {
      const view = toNotificationView({
        entityState: resolveNotificationEntityState({ deletionLookup, ref: row }),
        row,
      });

      if (view === null) {
        logger.warn(
          { notificationId: row.id, type: row.type },
          "Dropped a notification row whose stored payload does not match its type",
        );
        continue;
      }
      views.push(view);
    }

    return views;
  }
}
