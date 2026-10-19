import type { CustomListCard, Nullable, ReadingGoalResult, ReadingGoalView } from "@app/shared";

import { assertNever } from "@/lib/assert-never";

export type GoalListChoice =
  | { goalId: string; kind: "active" }
  | { kind: "create"; list: GoalListTarget; previousOutcome: Nullable<ReadingGoalResult> };

export type GoalListTarget = Pick<CustomListCard, "bookCount" | "id" | "name">;

export function resolveGoalListChoice({
  goal,
  list,
}: {
  goal: Nullable<ReadingGoalView>;
  list: GoalListTarget;
}): GoalListChoice {
  if (goal === null) return { kind: "create", list, previousOutcome: null };

  switch (goal.status) {
    case "active":
      return { goalId: goal.id, kind: "active" };
    case "archived":
      return { kind: "create", list, previousOutcome: null };
    case "completed":
    case "expired":
      return { kind: "create", list, previousOutcome: goal.status };
    default:
      return assertNever(goal.status);
  }
}
