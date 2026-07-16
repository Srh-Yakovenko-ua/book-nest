import type { Nullable, QueuePriority, QueuePriorityReason } from "@app/shared";

import { queuePriorityReasonSupportsDate } from "@app/shared";
import {
  CalendarClock,
  ChevronsDown,
  ChevronsUp,
  Ellipsis,
  LibraryBig,
  type LucideIcon,
  Minus,
  Sparkles,
  Target,
  Undo2,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { z } from "zod";

import { QUEUE_PRIORITY_DEFAULT } from "./book-organization-fields";

export type PriorityTone = "high" | "low" | "normal";

export type QueuePriorityFields = {
  addToReadingQueue?: boolean;
  queuePriority?: QueuePriority;
  queuePriorityReason?: Nullable<QueuePriorityReason>;
  queuePriorityReasonCustomText?: Nullable<string>;
  queuePriorityTargetDate?: Nullable<string>;
};

export const QUEUE_PRIORITY_ORDER = [
  "low",
  "normal",
  "high",
] as const satisfies readonly QueuePriority[];

export const QUEUE_PRIORITY_META = {
  high: { icon: ChevronsUp, tone: "high" },
  low: { icon: ChevronsDown, tone: "low" },
  normal: { icon: Minus, tone: "normal" },
} satisfies Record<QueuePriority, { icon: LucideIcon; tone: PriorityTone }>;

export const QUEUE_PRIORITY_REASON_ORDER = [
  "book_club",
  "buddy_read",
  "event_or_deadline",
  "return_due",
  "series_order",
  "reading_goal",
  "anticipated_release",
  "other",
] as const satisfies readonly QueuePriorityReason[];

export const QUEUE_PRIORITY_REASON_ICONS = {
  anticipated_release: Sparkles,
  book_club: Users,
  buddy_read: UserRoundCheck,
  event_or_deadline: CalendarClock,
  other: Ellipsis,
  reading_goal: Target,
  return_due: Undo2,
  series_order: LibraryBig,
} satisfies Record<QueuePriorityReason, LucideIcon>;

export const QUEUE_PRIORITY_REASON_LABEL_KEYS = {
  anticipated_release: "anticipatedRelease",
  book_club: "bookClub",
  buddy_read: "buddyRead",
  event_or_deadline: "eventOrDeadline",
  other: "other",
  reading_goal: "readingGoal",
  return_due: "returnDue",
  series_order: "seriesOrder",
} as const satisfies Record<QueuePriorityReason, string>;

export const QUEUE_PRIORITY_CUSTOM_REASON_REQUIRED_MESSAGE =
  "queue-priority-custom-reason-required";

export function buildQueuePriorityPayload<T extends QueuePriorityFields>(values: T): T {
  if (!values.addToReadingQueue) {
    return {
      ...values,
      queuePriority: undefined,
      queuePriorityReason: undefined,
      queuePriorityReasonCustomText: undefined,
      queuePriorityTargetDate: undefined,
    };
  }

  const queuePriority = values.queuePriority ?? QUEUE_PRIORITY_DEFAULT;

  if (queuePriority !== "high") {
    return {
      ...values,
      queuePriority,
      queuePriorityReason: null,
      queuePriorityReasonCustomText: null,
      queuePriorityTargetDate: null,
    };
  }

  const reason = values.queuePriorityReason ?? null;
  const queuePriorityReasonCustomText =
    reason === "other" ? trimToNull(values.queuePriorityReasonCustomText) : null;
  const queuePriorityTargetDate =
    reason !== null && reasonSupportsDate(reason) ? (values.queuePriorityTargetDate ?? null) : null;

  return {
    ...values,
    queuePriority,
    queuePriorityReason: reason,
    queuePriorityReasonCustomText,
    queuePriorityTargetDate,
  };
}

export function isCustomReasonMissing(value: QueuePriorityFields): boolean {
  return (
    value.addToReadingQueue === true &&
    value.queuePriority === "high" &&
    value.queuePriorityReason === "other" &&
    (value.queuePriorityReasonCustomText ?? "").trim().length === 0
  );
}

export function reasonSupportsDate(reason: QueuePriorityReason): boolean {
  return queuePriorityReasonSupportsDate(reason);
}

export function validateQueuePriority(
  value: QueuePriorityFields,
  ctx: z.core.$RefinementCtx,
): void {
  if (!isCustomReasonMissing(value)) return;
  ctx.addIssue({
    code: "custom",
    message: QUEUE_PRIORITY_CUSTOM_REASON_REQUIRED_MESSAGE,
    path: ["queuePriorityReasonCustomText"],
  });
}

function trimToNull(value: Nullable<string> | undefined): Nullable<string> {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
