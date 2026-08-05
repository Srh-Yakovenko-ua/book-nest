import type {
  NotificationEntityType,
  NotificationPayload,
  NotificationReason,
  Nullable,
} from "@app/shared";

export type NotificationDraft = {
  dedupeKey: string;
  entityId: Nullable<string>;
  entityType: Nullable<NotificationEntityType>;
  payload: NotificationPayload;
  reason: NotificationReason;
  resetsReadState: boolean;
};
