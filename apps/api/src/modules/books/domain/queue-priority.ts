import type { Nullable, QueuePriority, QueuePriorityReason } from "@app/shared";

import { queuePriorityReasonSupportsDate } from "@app/shared";

import { BadRequestError } from "../../../core/exceptions/errors.js";

export type QueuePriorityDetails = {
  customText: Nullable<string>;
  reason: Nullable<QueuePriorityReason>;
  targetDate: Nullable<string>;
};

export type QueuePriorityDetailsInput = {
  customText?: Nullable<string>;
  reason?: Nullable<QueuePriorityReason>;
  targetDate?: Nullable<string>;
};

export const EMPTY_QUEUE_PRIORITY_DETAILS: QueuePriorityDetails = {
  customText: null,
  reason: null,
  targetDate: null,
};

export const QUEUE_PRIORITY_REASON_HIGH_ONLY_MESSAGE =
  "Priority reason is only allowed for high priority";
export const QUEUE_PRIORITY_CUSTOM_TEXT_HIGH_ONLY_MESSAGE =
  "Custom reason text is only allowed for high priority";
export const QUEUE_PRIORITY_TARGET_DATE_HIGH_ONLY_MESSAGE =
  "Target date is only allowed for high priority";
export const QUEUE_PRIORITY_CUSTOM_TEXT_OTHER_ONLY_MESSAGE =
  "Custom reason text is only allowed when the reason is other";
export const QUEUE_PRIORITY_CUSTOM_TEXT_REQUIRED_MESSAGE =
  "Custom reason text is required when queuePriorityReason is other";
export const QUEUE_PRIORITY_TARGET_DATE_REQUIRES_REASON_MESSAGE =
  "Target date requires a priority reason";
export const QUEUE_PRIORITY_TARGET_DATE_UNSUPPORTED_MESSAGE =
  "Target date is not supported for the selected priority reason";

const REASON_FIELD = "queuePriorityReason";
const CUSTOM_TEXT_FIELD = "queuePriorityReasonCustomText";
const TARGET_DATE_FIELD = "queuePriorityTargetDate";

const isProvided = <Value>(value: undefined | Value): value is Value => value !== undefined;

export function resolveQueuePriorityDetails({
  current,
  input,
  resolvedPriority,
}: {
  current: QueuePriorityDetails;
  input: QueuePriorityDetailsInput;
  resolvedPriority: Nullable<QueuePriority>;
}): QueuePriorityDetails {
  if (resolvedPriority !== "high") {
    if (isProvided(input.reason) && input.reason !== null) {
      throw badRequest(REASON_FIELD, QUEUE_PRIORITY_REASON_HIGH_ONLY_MESSAGE);
    }
    if (isProvided(input.customText) && input.customText !== null) {
      throw badRequest(CUSTOM_TEXT_FIELD, QUEUE_PRIORITY_CUSTOM_TEXT_HIGH_ONLY_MESSAGE);
    }
    if (isProvided(input.targetDate) && input.targetDate !== null) {
      throw badRequest(TARGET_DATE_FIELD, QUEUE_PRIORITY_TARGET_DATE_HIGH_ONLY_MESSAGE);
    }
    return { customText: null, reason: null, targetDate: null };
  }

  const reason = isProvided(input.reason) ? input.reason : current.reason;
  const mergedCustomText = isProvided(input.customText) ? input.customText : current.customText;
  const mergedTargetDate = isProvided(input.targetDate) ? input.targetDate : current.targetDate;

  if (isProvided(input.customText) && input.customText !== null && reason !== "other") {
    throw badRequest(CUSTOM_TEXT_FIELD, QUEUE_PRIORITY_CUSTOM_TEXT_OTHER_ONLY_MESSAGE);
  }

  if (isProvided(input.targetDate) && input.targetDate !== null) {
    if (reason === null) {
      throw badRequest(TARGET_DATE_FIELD, QUEUE_PRIORITY_TARGET_DATE_REQUIRES_REASON_MESSAGE);
    }
    if (!queuePriorityReasonSupportsDate(reason)) {
      throw badRequest(TARGET_DATE_FIELD, QUEUE_PRIORITY_TARGET_DATE_UNSUPPORTED_MESSAGE);
    }
  }

  const customText = reason === "other" ? mergedCustomText : null;
  const targetDate =
    reason !== null && queuePriorityReasonSupportsDate(reason) ? mergedTargetDate : null;

  if (reason === "other") {
    const trimmed = customText === null ? "" : customText.trim();
    if (trimmed.length === 0) {
      throw badRequest(CUSTOM_TEXT_FIELD, QUEUE_PRIORITY_CUSTOM_TEXT_REQUIRED_MESSAGE);
    }
    return { customText: trimmed, reason, targetDate };
  }

  return { customText, reason, targetDate };
}

function badRequest(field: string, message: string): BadRequestError {
  return new BadRequestError(message, { fields: [{ field, message }] });
}
