import type { QueryKey } from "@tanstack/react-query";

import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { notificationChangeEffects } from "./notification-change-effects";
import { notificationKeys } from "./notification-keys";

const KEYS = {
  bookList: ["/api/books", "list", { page: 1 }],
  list: notificationKeys.list,
  unreadCount: notificationKeys.unreadCount,
} as const satisfies Record<string, QueryKey>;

describe("notificationChangeEffects", () => {
  it("refreshes the notification list and unread count but not books after a notification is created", async () => {
    const keys = [KEYS.list, KEYS.unreadCount, KEYS.bookList];
    const client = new QueryClient();
    for (const key of keys) client.setQueryData(key, {});

    await notificationChangeEffects.notificationCreated(client);

    expect(keys.map((key) => client.getQueryState(key)?.isInvalidated)).toEqual([
      true,
      true,
      false,
    ]);
  });
});
