import type { Nullable, RealtimeEvent } from "@app/shared";
import type { QueryClient } from "@tanstack/react-query";

import { REALTIME_CONTRACT, RealtimeEventSchema } from "@app/shared";

import { bookChangeEffects } from "@/features/books/api/book-change-effects";
import { notificationChangeEffects } from "@/features/notifications/api/notification-change-effects";

export function applyRealtimeEvent({
  event,
  queryClient,
}: {
  event: RealtimeEvent;
  queryClient: QueryClient;
}): void {
  switch (event.type) {
    case REALTIME_CONTRACT.events.mediaThumbnailReady:
      void bookChangeEffects.booksChanged(queryClient, { changes: ["thumbnailReady"] });
      return;
    case REALTIME_CONTRACT.events.notificationsChanged:
      void notificationChangeEffects.unreadCountChanged(queryClient, event.unreadCount);
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
