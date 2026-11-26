import type { ReadingGoalCheckpoint } from "@app/shared";

import { differenceInCalendarDays, isAfter, parseISO } from "date-fns";

export type GoalCheckpointState =
  | { achievedAt: string; kind: "achieved" }
  | { achievedAt: string; kind: "achieved_late"; lateDays: number }
  | { kind: "missed" }
  | { kind: "upcoming" };

export type GoalCheckpointSummary = {
  late: number;
  reached: number;
  total: number;
};

export function resolveGoalCheckpointState(checkpoint: ReadingGoalCheckpoint): GoalCheckpointState {
  const { achievedAt, dueDate, status } = checkpoint;

  if (achievedAt !== null) {
    const achievedDay = parseISO(achievedAt);
    const dueDay = parseISO(dueDate);
    if (!isAfter(achievedDay, dueDay)) return { achievedAt, kind: "achieved" };
    return {
      achievedAt,
      kind: "achieved_late",
      lateDays: differenceInCalendarDays(achievedDay, dueDay),
    };
  }
  return status === "missed" ? { kind: "missed" } : { kind: "upcoming" };
}

export function summarizeGoalCheckpointStates(
  states: GoalCheckpointState[],
): GoalCheckpointSummary {
  return {
    late: states.filter((state) => state.kind === "achieved_late").length,
    reached: states.filter((state) => state.kind === "achieved" || state.kind === "achieved_late")
      .length,
    total: states.length,
  };
}
