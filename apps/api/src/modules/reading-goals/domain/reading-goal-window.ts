import type { Nullable, ReadingGoalStatus } from "@app/shared";

import { min } from "date-fns";

import { assertNever } from "../../../core/assert-never.js";
import { startOfUtcDay } from "../../../core/iso-date.js";

type CountingEndInput = {
  archivedAt: Nullable<Date>;
  deadline: Date;
};

type ObservationEndInput = CountingEndInput & {
  completedAt: Nullable<Date>;
  now: Date;
  status: ReadingGoalStatus;
};

export function resolveReadingGoalCountingEnd({ archivedAt, deadline }: CountingEndInput): Date {
  if (archivedAt === null) {
    return startOfUtcDay(deadline);
  }
  return earliestUtcDay([archivedAt, deadline]);
}

export function resolveReadingGoalObservationEnd({
  archivedAt,
  completedAt,
  deadline,
  now,
  status,
}: ObservationEndInput): Date {
  const countingEndsAt = resolveReadingGoalCountingEnd({ archivedAt, deadline });
  switch (status) {
    case "active":
      return earliestUtcDay([now, countingEndsAt]);
    case "archived":
      return countingEndsAt;
    case "completed":
      return completedAt === null ? countingEndsAt : earliestUtcDay([completedAt, countingEndsAt]);
    case "expired":
      return countingEndsAt;
    default:
      return assertNever(status);
  }
}

function earliestUtcDay(dates: Date[]): Date {
  return min(dates.map((date) => startOfUtcDay(date)));
}
