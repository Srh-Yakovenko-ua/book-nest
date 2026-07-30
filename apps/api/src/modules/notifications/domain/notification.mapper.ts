import type { NotificationEntityState, NotificationView, Nullable } from "@app/shared";

import { NotificationViewSchema } from "@app/shared";

import type { NotificationModel } from "../../../generated/prisma/models.js";

import { toNullableIsoDateTime } from "../../../core/iso-date.js";

export type NotificationRow = Pick<
  NotificationModel,
  "createdAt" | "entityId" | "entityType" | "id" | "level" | "params" | "readAt" | "reason" | "type"
>;

export function toNotificationView({
  entityState,
  row,
}: {
  entityState: Nullable<NotificationEntityState>;
  row: NotificationRow;
}): Nullable<NotificationView> {
  const parsed = NotificationViewSchema.safeParse({
    createdAt: row.createdAt.toISOString(),
    entityState,
    id: row.id,
    level: row.level,
    payload: toPayloadCandidate({ params: row.params, type: row.type }),
    readAt: toNullableIsoDateTime(row.readAt),
    reason: row.reason,
  });

  return parsed.success ? parsed.data : null;
}

function toPayloadCandidate({ params, type }: { params: unknown; type: string }): unknown {
  if (typeof params !== "object" || params === null || Array.isArray(params)) {
    return { type };
  }
  return { ...params, type };
}
