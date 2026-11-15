import type { NotificationUnreadCount } from "@app/shared";

import { NotificationUnreadCountSchema } from "@app/shared";
import { useQuery } from "@tanstack/react-query";

import { notificationsControllerUnreadCount } from "@/shared/api/generated/endpoints/notifications/notifications";

import { notificationKeys } from "./notification-keys";

export function useNotificationsUnreadCount() {
  return useQuery({
    queryFn: async ({ signal }): Promise<NotificationUnreadCount> =>
      NotificationUnreadCountSchema.parse(await notificationsControllerUnreadCount({ signal })),
    queryKey: notificationKeys.unreadCount,
    refetchOnWindowFocus: true,
  });
}
