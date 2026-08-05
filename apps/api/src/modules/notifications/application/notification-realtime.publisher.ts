import { REALTIME_CONTRACT } from "@app/shared";
import { Injectable } from "@nestjs/common";

import { createLogger } from "../../../core/logger.js";
import { RealtimePort } from "../../realtime/index.js";
import { NotificationsRepository } from "../infrastructure/notifications.repository.js";

const log = createLogger("notifications.realtime-publisher");

@Injectable()
export class NotificationRealtimePublisher {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
    private readonly realtime: RealtimePort,
  ) {}

  async publishUnreadCount({ userId }: { userId: string }): Promise<void> {
    try {
      if (!(await this.realtime.hasListeners({ userId }))) {
        return;
      }

      const unreadCount = await this.notificationsRepository.countUnread({ userId });

      this.realtime.emitToUser({
        event: { type: REALTIME_CONTRACT.events.notificationsChanged, unreadCount },
        userId,
      });
    } catch (error) {
      log.warn({ err: error, userId }, "failed to publish the unread notification count");
    }
  }
}
