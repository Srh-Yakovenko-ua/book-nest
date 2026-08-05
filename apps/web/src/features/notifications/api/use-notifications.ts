import type { NotificationListResponse } from "@app/shared";
import type { InfiniteData } from "@tanstack/react-query";

import { NOTIFICATION_BOUNDS, NotificationListResponseSchema } from "@app/shared";
import { useInfiniteQuery } from "@tanstack/react-query";

import { notificationsControllerList } from "@/shared/api/generated/endpoints/notifications/notifications";

import { notificationKeys } from "./notification-keys";

export function useNotifications({ enabled }: { enabled: boolean }) {
  return useInfiniteQuery<
    NotificationListResponse,
    Error,
    InfiniteData<NotificationListResponse>,
    typeof notificationKeys.list,
    string | undefined
  >({
    enabled,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) =>
      NotificationListResponseSchema.parse(
        await notificationsControllerList({
          cursor: pageParam,
          limit: NOTIFICATION_BOUNDS.pageSizeDefault,
        }),
      ),
    queryKey: notificationKeys.list,
  });
}
