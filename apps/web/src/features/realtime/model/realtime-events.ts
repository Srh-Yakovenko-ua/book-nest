import type { NotificationUnreadCount, Nullable, RealtimeEvent } from "@app/shared";
import type { QueryClient, QueryKey } from "@tanstack/react-query";

import { REALTIME_CONTRACT, RealtimeEventSchema } from "@app/shared";

import { bookKeys } from "@/features/books/api/book-keys";
import {
  getNotificationsControllerListQueryKey,
  getNotificationsControllerUnreadCountQueryKey,
} from "@/shared/api/generated/endpoints/notifications/notifications";

const REALTIME_QUERY_TARGETS = {
  booksRoot: bookKeys.root,
  notificationsList: getNotificationsControllerListQueryKey(),
  notificationsUnreadCount: getNotificationsControllerUnreadCountQueryKey(),
} as const satisfies Record<string, QueryKey>;

export function applyRealtimeEvent({
  event,
  queryClient,
}: {
  event: RealtimeEvent;
  queryClient: QueryClient;
}): void {
  switch (event.type) {
    case REALTIME_CONTRACT.events.mediaThumbnailReady:
      void queryClient.invalidateQueries({ queryKey: REALTIME_QUERY_TARGETS.booksRoot });
      return;
    case REALTIME_CONTRACT.events.notificationsChanged:
      queryClient.setQueryData<NotificationUnreadCount>(
        REALTIME_QUERY_TARGETS.notificationsUnreadCount,
        { unreadCount: event.unreadCount },
      );
      void queryClient.invalidateQueries({ queryKey: REALTIME_QUERY_TARGETS.notificationsList });
      return;
    default:
      return assertNever(event);
  }
}

export function parseRealtimeFrame(payload: unknown): Nullable<RealtimeEvent> {
  const parsed = RealtimeEventSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

function assertNever(value: never): never {
  throw new Error(`unhandled realtime event: ${JSON.stringify(value)}`);
}
