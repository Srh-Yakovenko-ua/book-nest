import { formatInTimeZone } from "date-fns-tz";

import type { DeliveryReminderStage, LoanReminderStage } from "./notification-cadence.js";

import { assertNever } from "../../../core/assert-never.js";

const DEDUPE_HOUR_FORMAT = "yyyy-MM-dd'T'HH";
const DEDUPE_TIME_ZONE = "UTC";

export function buildDeliveryDedupeKey({
  deliveryId,
  stage,
}: {
  deliveryId: string;
  stage: DeliveryReminderStage;
}): string {
  return `delivery:${deliveryId}:${stage}`;
}

export function buildLoanDedupeKey({
  loanId,
  stage,
}: {
  loanId: string;
  stage: LoanReminderStage;
}): string {
  switch (stage.kind) {
    case "due_soon":
      return `loan:${loanId}:due_soon`;
    case "due_today":
      return `loan:${loanId}:due_today`;
    case "overdue":
      return `loan:${loanId}:overdue:${stage.stage}`;
    default:
      return assertNever(stage);
  }
}

export function buildTestDedupeKey({
  requestedAt,
  userId,
}: {
  requestedAt: Date;
  userId: string;
}): string {
  return `test:${userId}:${toIsoHour(requestedAt)}`;
}

export function toIsoHour(instant: Date): string {
  return formatInTimeZone(instant, DEDUPE_TIME_ZONE, DEDUPE_HOUR_FORMAT);
}
