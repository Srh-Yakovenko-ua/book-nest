import type { OwnershipStatus, ReadingStatus } from "@app/shared";

export const NEXT_READ_ELIGIBILITY = {
  availableOwnership: ["borrowed_from_someone", "owned"],
  libraryStatuses: ["not_started", "want_to_read"],
  queueStatuses: ["not_started", "paused", "want_to_read"],
} as const satisfies {
  availableOwnership: readonly OwnershipStatus[];
  libraryStatuses: readonly ReadingStatus[];
  queueStatuses: readonly ReadingStatus[];
};

const AVAILABLE_OWNERSHIP: ReadonlySet<string> = new Set<string>(
  NEXT_READ_ELIGIBILITY.availableOwnership,
);

const QUEUE_STATUSES: ReadonlySet<string> = new Set<string>(NEXT_READ_ELIGIBILITY.queueStatuses);

export function collectSeriesOrderBlockedBookIds(
  issues: readonly {
    affectedBook: { id: string };
    relatedProblems: readonly { affectedBookId: string }[];
  }[],
): Set<string> {
  return new Set(
    issues.flatMap((issue) => [
      issue.affectedBook.id,
      ...issue.relatedProblems.map((problem) => problem.affectedBookId),
    ]),
  );
}

export function isAvailableOwnership(ownershipStatus: string): boolean {
  return AVAILABLE_OWNERSHIP.has(ownershipStatus);
}

export function isQueueEligibleStatus(readingStatus: string): boolean {
  return QUEUE_STATUSES.has(readingStatus);
}
