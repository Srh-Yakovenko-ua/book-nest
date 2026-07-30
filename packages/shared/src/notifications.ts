import { z } from "zod";

import type { ValueOf } from "./common.js";

export const NOTIFICATION_BOUNDS = {
  listLimitMax: 50,
  markReadMax: 100,
  overdueStageMax: 3,
  overdueStageMin: 1,
  pageSizeDefault: 20,
  unreadBadgeCap: 99,
} as const satisfies Record<string, number>;

export const NOTIFICATION_TYPES = {
  deliveryArrivingSoon: "delivery.arriving_soon",
  deliveryArrivingToday: "delivery.arriving_today",
  deliveryDelayed: "delivery.delayed",
  loanDueSoon: "loan.due_soon",
  loanDueToday: "loan.due_today",
  loanOverdue: "loan.overdue",
  systemTest: "system.test",
} as const satisfies Record<string, string>;

export const NotificationTypeSchema = z.enum(NOTIFICATION_TYPES);

export type NotificationType = ValueOf<typeof NOTIFICATION_TYPES>;

export const NotificationLevelSchema = z.enum(["normal", "passive", "time_sensitive"]);

export type NotificationLevel = z.infer<typeof NotificationLevelSchema>;

export const NOTIFICATION_LEVEL_BY_TYPE = {
  "delivery.arriving_soon": "passive",
  "delivery.arriving_today": "normal",
  "delivery.delayed": "normal",
  "loan.due_soon": "normal",
  "loan.due_today": "normal",
  "loan.overdue": "time_sensitive",
  "system.test": "normal",
} as const satisfies Record<NotificationType, NotificationLevel>;

export const NotificationReasonSchema = z.enum(["global_setting", "loan_opt_in", "manual_test"]);

export type NotificationReason = z.infer<typeof NotificationReasonSchema>;

export const NotificationEntityTypeSchema = z.enum(["book"]);

export type NotificationEntityType = z.infer<typeof NotificationEntityTypeSchema>;

export const NotificationEntityStateSchema = z.enum(["gone", "live", "trashed"]);

export type NotificationEntityState = z.infer<typeof NotificationEntityStateSchema>;

export const NotificationChannelSchema = z.enum(["email"]);

export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;

export const NotificationDeliveryStatusSchema = z.enum(["failed", "pending", "sent"]);

export type NotificationDeliveryStatus = z.infer<typeof NotificationDeliveryStatusSchema>;

const loanPayloadFields = {
  bookId: z.uuid(),
  bookTitle: z.string(),
  dueDate: z.iso.date(),
  personName: z.string(),
};

const deliveryPayloadFields = {
  bookId: z.uuid(),
  bookTitle: z.string(),
  expectedDate: z.iso.date(),
  storeName: z.string().nullable(),
};

export const NotificationPayloadSchema = z.discriminatedUnion("type", [
  z.object({
    ...deliveryPayloadFields,
    type: z.literal(NOTIFICATION_TYPES.deliveryArrivingSoon),
  }),
  z.object({
    ...deliveryPayloadFields,
    type: z.literal(NOTIFICATION_TYPES.deliveryArrivingToday),
  }),
  z.object({
    ...deliveryPayloadFields,
    type: z.literal(NOTIFICATION_TYPES.deliveryDelayed),
  }),
  z.object({
    ...loanPayloadFields,
    type: z.literal(NOTIFICATION_TYPES.loanDueSoon),
  }),
  z.object({
    ...loanPayloadFields,
    type: z.literal(NOTIFICATION_TYPES.loanDueToday),
  }),
  z.object({
    ...loanPayloadFields,
    daysOverdue: z.number().int().positive(),
    stage: z
      .number()
      .int()
      .min(NOTIFICATION_BOUNDS.overdueStageMin)
      .max(NOTIFICATION_BOUNDS.overdueStageMax),
    type: z.literal(NOTIFICATION_TYPES.loanOverdue),
  }),
  z.object({
    requestedAt: z.iso.datetime(),
    type: z.literal(NOTIFICATION_TYPES.systemTest),
  }),
]);

export type NotificationPayload = z.infer<typeof NotificationPayloadSchema>;

type _EveryNotificationTypeHasPayloadArm = AssertNever<
  Exclude<NotificationType, NotificationPayload["type"]>
>;

type AssertNever<T extends never> = T;

export const NotificationViewSchema = z.object({
  createdAt: z.iso.datetime(),
  entityState: NotificationEntityStateSchema.nullable(),
  id: z.uuid(),
  level: NotificationLevelSchema,
  payload: NotificationPayloadSchema,
  readAt: z.iso.datetime().nullable(),
  reason: NotificationReasonSchema,
});

export type NotificationView = z.infer<typeof NotificationViewSchema>;

export const NotificationListQuerySchema = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(NOTIFICATION_BOUNDS.listLimitMax)
    .default(NOTIFICATION_BOUNDS.pageSizeDefault),
  unreadOnly: z.stringbool().optional(),
});

export type NotificationListQuery = z.infer<typeof NotificationListQuerySchema>;

export const NotificationListResponseSchema = z.object({
  items: z.array(NotificationViewSchema),
  nextCursor: z.uuid().nullable(),
  unreadCount: z.number().int().nonnegative(),
});

export type NotificationListResponse = z.infer<typeof NotificationListResponseSchema>;

export const NotificationUnreadCountSchema = z.object({
  unreadCount: z.number().int().nonnegative(),
});

export type NotificationUnreadCount = z.infer<typeof NotificationUnreadCountSchema>;

export const MarkNotificationsReadInputSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(NOTIFICATION_BOUNDS.markReadMax),
});

export type MarkNotificationsReadInput = z.infer<typeof MarkNotificationsReadInputSchema>;
