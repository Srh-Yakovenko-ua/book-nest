import type { RealtimeEvent } from "@app/shared";
import type { QueryKey } from "@tanstack/react-query";

import { REALTIME_CONTRACT } from "@app/shared";
import { describe, expect, it } from "vitest";

import { makeMediaView } from "@/features/lists/model/lists.fixtures";
import { notificationKeys } from "@/features/notifications/api/notification-keys";
import { seriesKeys } from "@/features/series/api/series-keys";
import { seededClient, staleFlags } from "@/test-query-cache";

import { applyRealtimeEvent } from "./realtime-events";

const KEYS = {
  bookList: ["/api/books", "list", { page: 1 }],
  notificationList: notificationKeys.list,
  series: seriesKeys.overview,
} as const satisfies Record<string, QueryKey>;

const EVENTS = {
  notificationsChanged: {
    type: REALTIME_CONTRACT.events.notificationsChanged,
    unreadCount: 4,
  },
  thumbnailReady: {
    media: makeMediaView(),
    type: REALTIME_CONTRACT.events.mediaThumbnailReady,
  },
} as const satisfies Record<string, RealtimeEvent>;

describe("applyRealtimeEvent", () => {
  it("refreshes books but not notifications or series when a thumbnail is ready", () => {
    const keys = [KEYS.bookList, KEYS.notificationList, KEYS.series];
    const client = seededClient(keys);

    applyRealtimeEvent({ event: EVENTS.thumbnailReady, queryClient: client });

    expect(staleFlags(client, keys)).toEqual([true, false, false]);
  });

  it("writes the pushed unread count when notifications change", () => {
    const client = seededClient([notificationKeys.unreadCount]);

    applyRealtimeEvent({ event: EVENTS.notificationsChanged, queryClient: client });

    expect(client.getQueryData(notificationKeys.unreadCount)).toEqual({ unreadCount: 4 });
  });

  it("refreshes the notification list but not books when notifications change", () => {
    const keys = [KEYS.notificationList, KEYS.bookList];
    const client = seededClient(keys);

    applyRealtimeEvent({ event: EVENTS.notificationsChanged, queryClient: client });

    expect(staleFlags(client, keys)).toEqual([true, false]);
  });
});
