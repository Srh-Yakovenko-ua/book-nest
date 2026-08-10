import type { ReadingGoalStatus } from "@app/shared";

import type { UiIconName } from "@/components/icons";

type GoalStatusBadge = {
  icon: UiIconName;
  tone: "info" | "secondary" | "success" | "warning";
};

export const GOAL_STATUS_BADGE = {
  active: { icon: "target", tone: "info" },
  archived: { icon: "inbox", tone: "secondary" },
  completed: { icon: "trophy", tone: "success" },
  expired: { icon: "clock", tone: "warning" },
} as const satisfies Record<ReadingGoalStatus, GoalStatusBadge>;
