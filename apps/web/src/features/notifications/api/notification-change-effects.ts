import type { NotificationUnreadCount } from "@app/shared";
import type { QueryClient } from "@tanstack/react-query";

import { notificationKeys } from "./notification-keys";

function notificationCreated(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: notificationKeys.root });
}

function unreadCountChanged(
  queryClient: QueryClient,
  unreadCount: NotificationUnreadCount["unreadCount"],
): Promise<void> {
  queryClient.setQueryData<NotificationUnreadCount>(notificationKeys.unreadCount, { unreadCount });
  return queryClient.invalidateQueries({ queryKey: notificationKeys.list });
}

export const notificationChangeEffects = { notificationCreated, unreadCountChanged };
