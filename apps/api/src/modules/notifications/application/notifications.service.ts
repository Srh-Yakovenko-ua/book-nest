import type {
  NotificationListQuery,
  NotificationListResponse,
  NotificationUnreadCount,
  NotificationView,
  Nullable,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { AuthenticatedUser } from "../../auth/index.js";
import type {
  EntityDeletionLookup,
  NotificationEntityRef,
} from "../domain/notification-entity-state.js";
import type { NotificationCursor } from "../infrastructure/notifications.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { createLogger } from "../../../core/logger.js";
import {
  collectBookEntityIds,
  resolveNotificationEntityState,
} from "../domain/notification-entity-state.js";
import { type NotificationRow, toNotificationView } from "../domain/notification.mapper.js";
import { buildTestNotification } from "../domain/test-notification.builder.js";
import { NotificationsRepository } from "../infrastructure/notifications.repository.js";
import { NotificationRealtimePublisher } from "./notification-realtime.publisher.js";
import { NotificationWriterService } from "./notification-writer.service.js";

const CURSOR_NOT_FOUND_MESSAGE = "Notification cursor not found";

const logger = createLogger("notifications.service");

type ListInput = {
  query: NotificationListQuery;
  userId: string;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly realtimePublisher: NotificationRealtimePublisher,
    private readonly writer: NotificationWriterService,
  ) {}

  async createTestNotification({ user }: { user: AuthenticatedUser }): Promise<void> {
    const requestedAt = new Date();

    const { emailDeliveryCreated } = await this.writer.write({
      emailPreferenceEnabled: true,
      emailVerified: user.emailVerifiedAt !== null,
      notification: buildTestNotification({ requestedAt, userId: user.id }),
      userId: user.id,
    });

    await this.realtimePublisher.publishUnreadCount({ userId: user.id });

    if (emailDeliveryCreated) {
      await this.writer.enqueueDigest({ now: requestedAt, userId: user.id });
    }
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
    await this.realtimePublisher.publishUnreadCount({ userId });
  }

  async markRead({ ids, userId }: { ids: string[]; userId: string }): Promise<void> {
    await this.notificationsRepository.markRead({ ids, readAt: new Date(), userId });
    await this.realtimePublisher.publishUnreadCount({ userId });
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
