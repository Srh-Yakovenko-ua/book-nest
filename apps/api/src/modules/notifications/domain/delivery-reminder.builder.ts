import type { NotificationPayload, Nullable } from "@app/shared";

import { NOTIFICATION_TYPES } from "@app/shared";

import type { DeliveryReminderStage } from "./notification-cadence.js";
import type { NotificationDraft } from "./notification-draft.js";

import { assertNever } from "../../../core/assert-never.js";
import { toIsoDate } from "../../../core/iso-date.js";
import { deliveryStage } from "./notification-cadence.js";
import { buildDeliveryDedupeKey } from "./notification-dedupe.js";
import { BOOK_ENTITY_TYPE } from "./notification-entity-state.js";

export type DeliveryReminderCandidate = {
  bookId: string;
  bookTitle: string;
  expectedDeliveryDate: Nullable<Date>;
  id: string;
  storeName: Nullable<string>;
};

type DeliveryReminderPayload = Extract<
  NotificationPayload,
  {
    type:
      | typeof NOTIFICATION_TYPES.deliveryArrivingSoon
      | typeof NOTIFICATION_TYPES.deliveryArrivingToday
      | typeof NOTIFICATION_TYPES.deliveryDelayed;
  }
>;

export function buildDeliveryReminder({
  candidate,
  today,
}: {
  candidate: DeliveryReminderCandidate;
  today: string;
}): Nullable<NotificationDraft> {
  if (candidate.expectedDeliveryDate === null) {
    return null;
  }

  const expectedDate = toIsoDate(candidate.expectedDeliveryDate);
  const stage = deliveryStage({ expectedDeliveryDate: expectedDate, today });

  if (stage === null) {
    return null;
  }

  return {
    dedupeKey: buildDeliveryDedupeKey({ deliveryId: candidate.id, stage }),
    entityId: candidate.bookId,
    entityType: BOOK_ENTITY_TYPE,
    payload: toDeliveryPayload({ candidate, expectedDate, stage }),
    reason: "global_setting",
    resetsReadState: false,
  };
}

function toDeliveryPayload({
  candidate,
  expectedDate,
  stage,
}: {
  candidate: DeliveryReminderCandidate;
  expectedDate: string;
  stage: DeliveryReminderStage;
}): DeliveryReminderPayload {
  const shared = {
    bookId: candidate.bookId,
    bookTitle: candidate.bookTitle,
    expectedDate,
    storeName: candidate.storeName,
  };

  switch (stage) {
    case "arriving_soon":
      return { ...shared, type: NOTIFICATION_TYPES.deliveryArrivingSoon };
    case "arriving_today":
      return { ...shared, type: NOTIFICATION_TYPES.deliveryArrivingToday };
    case "delayed":
      return { ...shared, type: NOTIFICATION_TYPES.deliveryDelayed };
    default:
      return assertNever(stage);
  }
}
