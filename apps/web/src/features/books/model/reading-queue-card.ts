import type {
  BookView,
  Nullable,
  OwnershipStatus,
  QueuePriority,
  QueuePriorityReason,
} from "@app/shared";

import { ownershipStatuses, type StatusEntry } from "@/lib/book-status";

export type ReadingQueueCard = {
  ownership: StatusEntry;
  priority: Nullable<QueuePriority>;
  reason: Nullable<QueuePriorityReason>;
  reasonCustomText: Nullable<string>;
  targetDate: Nullable<string>;
};

export function toReadingQueueCard(
  book: BookView,
  ownershipLabel: (value: OwnershipStatus) => string,
): ReadingQueueCard {
  return {
    ownership: toQueueOwnership(book.ownershipStatus, ownershipLabel),
    priority: book.queuePriority,
    reason: book.queuePriorityReason,
    reasonCustomText: book.queuePriorityReasonCustomText,
    targetDate: book.queuePriorityTargetDate,
  };
}

function toQueueOwnership(
  status: OwnershipStatus,
  label: (value: OwnershipStatus) => string,
): StatusEntry {
  const base = ownershipStatuses.find((entry) => entry.value === status) ?? ownershipStatuses[0];
  return { ...base, label: label(status) };
}
