import type { ReadingGoalPace, ReadingGoalRiskLevel, ReadingGoalStatus } from "@app/shared";

import type { UiIconName } from "@/components/icons";

type GoalSignalTone = "destructive" | "info" | "secondary" | "success" | "warning";

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

export const GOAL_SIGNAL_TONE = {
  pace: { ahead: "success", behind: "warning", critical: "destructive", on_track: "info" },
  risk: { critical: "destructive", high: "destructive", low: "secondary", medium: "warning" },
} as const satisfies {
  pace: Record<ReadingGoalPace, GoalSignalTone>;
  risk: Record<Exclude<ReadingGoalRiskLevel, "none">, GoalSignalTone>;
};
