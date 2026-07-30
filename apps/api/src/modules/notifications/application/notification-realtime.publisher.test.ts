import { REALTIME_CONTRACT } from "@app/shared";
import { describe, expect, it, vi } from "vitest";

import type { RealtimePort } from "../../realtime/index.js";
import type { NotificationsRepository } from "../infrastructure/notifications.repository.js";

import { fakeOf } from "../../../test/fake.js";
import { NotificationRealtimePublisher } from "./notification-realtime.publisher.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const UNREAD_COUNT = 4;

function buildPublisher(overrides: { hasListeners?: boolean } = {}): {
  countUnread: ReturnType<typeof vi.fn>;
  emitToUser: ReturnType<typeof vi.fn>;
  publisher: NotificationRealtimePublisher;
} {
  const countUnread = vi.fn().mockResolvedValue(UNREAD_COUNT);
  const emitToUser = vi.fn();
  const hasListeners = vi.fn().mockResolvedValue(overrides.hasListeners ?? true);

  const publisher = new NotificationRealtimePublisher(
    fakeOf<NotificationsRepository>({ countUnread }),
    fakeOf<RealtimePort>({ emitToUser, hasListeners }),
  );

  return { countUnread, emitToUser, publisher };
}

describe("NotificationRealtimePublisher.publishUnreadCount", () => {
  it("emits the freshly counted unread total to the owning user", async () => {
    const { countUnread, emitToUser, publisher } = buildPublisher();

    await publisher.publishUnreadCount({ userId: USER_ID });

    expect(countUnread).toHaveBeenCalledWith({ userId: USER_ID });
    expect(emitToUser).toHaveBeenCalledWith({
      event: {
        type: REALTIME_CONTRACT.events.notificationsChanged,
        unreadCount: UNREAD_COUNT,
      },
      userId: USER_ID,
    });
  });

  it("skips the count query when the user holds no socket on this process", async () => {
    const { countUnread, emitToUser, publisher } = buildPublisher({ hasListeners: false });

    await publisher.publishUnreadCount({ userId: USER_ID });

    expect(countUnread).not.toHaveBeenCalled();
    expect(emitToUser).not.toHaveBeenCalled();
  });

  it("resolves instead of throwing when the count query fails", async () => {
    const { countUnread, emitToUser, publisher } = buildPublisher();
    countUnread.mockRejectedValue(new Error("connection terminated unexpectedly"));

    await expect(publisher.publishUnreadCount({ userId: USER_ID })).resolves.toBeUndefined();
    expect(emitToUser).not.toHaveBeenCalled();
  });
});
