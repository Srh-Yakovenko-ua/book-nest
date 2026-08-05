import type {
  NotificationEntityState,
  NotificationPayload,
  NotificationView,
  Nullable,
} from "@app/shared";

import { NotificationPayloadSchema, NotificationViewSchema } from "@app/shared";

import type { NotificationModel } from "../../../generated/prisma/models.js";

import { toNullableIsoDateTime } from "../../../core/iso-date.js";

export type NotificationRow = Pick<
  NotificationModel,
  "createdAt" | "entityId" | "entityType" | "id" | "level" | "params" | "readAt" | "reason" | "type"
>;

type StoredNotificationParams = Record<string, Nullable<number | string>>;

export function toNotificationPayload({
  params,
  type,
}: {
  params: unknown;
  type: string;
}): Nullable<NotificationPayload> {
  const isPlainObject = typeof params === "object" && params !== null && !Array.isArray(params);
  const parsed = NotificationPayloadSchema.safeParse(
    isPlainObject ? { ...params, type } : { type },
  );

  return parsed.success ? parsed.data : null;
}

export function toNotificationView({
  entityState,
  row,
}: {
  entityState: Nullable<NotificationEntityState>;
  row: NotificationRow;
}): Nullable<NotificationView> {
  const payload = toNotificationPayload({ params: row.params, type: row.type });
  if (payload === null) {
    return null;
  }

  const parsed = NotificationViewSchema.safeParse({
    createdAt: row.createdAt.toISOString(),
    entityState,
    id: row.id,
    level: row.level,
    payload,
    readAt: toNullableIsoDateTime(row.readAt),
    reason: row.reason,
  });

  return parsed.success ? parsed.data : null;
}

export function toStoredNotificationParams(payload: NotificationPayload): StoredNotificationParams {
  const { type: _discriminant, ...params } = payload;
  return params;
}
