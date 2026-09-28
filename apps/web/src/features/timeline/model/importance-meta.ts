import type { TimelineImportance } from "@app/shared";

import type { UiIconName } from "@/components/icons";

type ImportanceMeta = {
  icon: UiIconName;
  labelKey: string;
  tone: "neutral" | "outline" | "primary" | "warning";
};

export const IMPORTANCE_META = {
  high: { icon: "arrow-up", labelKey: "importance.high", tone: "warning" },
  key: { icon: "star", labelKey: "importance.key", tone: "primary" },
  low: { icon: "arrow-down", labelKey: "importance.low", tone: "outline" },
  medium: { icon: "minus", labelKey: "importance.medium", tone: "neutral" },
} as const satisfies Record<TimelineImportance, ImportanceMeta>;

export function importanceMeta(importance: TimelineImportance) {
  return IMPORTANCE_META[importance];
}
