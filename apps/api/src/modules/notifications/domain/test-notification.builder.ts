import { NOTIFICATION_TYPES } from "@app/shared";

import type { NotificationDraft } from "./notification-draft.js";

import { buildTestDedupeKey } from "./notification-dedupe.js";

export function buildTestNotification({
  requestedAt,
  userId,
}: {
  requestedAt: Date;
  userId: string;
}): NotificationDraft {
  return {
    dedupeKey: buildTestDedupeKey({ requestedAt, userId }),
    entityId: null,
    entityType: null,
    payload: {
      requestedAt: requestedAt.toISOString(),
      type: NOTIFICATION_TYPES.systemTest,
    },
    reason: "manual_test",
    resetsReadState: true,
  };
}
