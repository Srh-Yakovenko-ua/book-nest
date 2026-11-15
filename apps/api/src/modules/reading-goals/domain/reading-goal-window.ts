import type { Nullable, ReadingGoalStatus } from "@app/shared";

import { min } from "date-fns";

import { assertNever } from "../../../core/assert-never.js";
import { startOfUtcDay } from "../../../core/iso-date.js";

export type ReadingGoalQualificationWindow = {
  countingEndsAt: Date;
  goalStartDate: Date;
};

type CountingEndInput = {
  archivedDay: Nullable<Date>;
  deadline: Date;
};

type ObservationEndInput = CountingEndInput & {
  completedAt: Nullable<Date>;
  status: ReadingGoalStatus;
  today: Date;
};

type QualificationWindowInput = CountingEndInput & {
  createdDay: Date;
};

export function resolveReadingGoalCountingEnd({ archivedDay, deadline }: CountingEndInput): Date {
  if (archivedDay === null) {
    return startOfUtcDay(deadline);
  }
  return earliestUtcDay([archivedDay, deadline]);
}

export function resolveReadingGoalObservationEnd({
  archivedDay,
  completedAt,
  deadline,
  status,
  today,
}: ObservationEndInput): Date {
  const countingEndsAt = resolveReadingGoalCountingEnd({ archivedDay, deadline });
  switch (status) {
    case "active":
      return earliestUtcDay([today, countingEndsAt]);
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

export function resolveReadingGoalQualificationWindow({
  archivedDay,
  createdDay,
  deadline,
}: QualificationWindowInput): ReadingGoalQualificationWindow {
  return {
    countingEndsAt: resolveReadingGoalCountingEnd({ archivedDay, deadline }),
    goalStartDate: createdDay,
  };
}

function earliestUtcDay(dates: Date[]): Date {
  return min(dates.map((date) => startOfUtcDay(date)));
}
