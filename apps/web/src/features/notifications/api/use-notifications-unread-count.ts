import { NotificationUnreadCountSchema } from "@app/shared";

import { useNotificationsControllerUnreadCount } from "@/shared/api/generated/endpoints/notifications/notifications";

import { notificationKeys } from "./notification-keys";

export function useNotificationsUnreadCount() {
  return useNotificationsControllerUnreadCount({
    query: {
      queryKey: notificationKeys.unreadCount,
      refetchOnWindowFocus: true,
      select: (data) => NotificationUnreadCountSchema.parse(data),
    },
  });
}
