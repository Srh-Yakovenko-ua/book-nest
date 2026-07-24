import type { TimelineImportance } from "@app/shared";

type ImportanceMeta = {
  badgeClass: string;
  labelKey: string;
};

export const IMPORTANCE_META = {
  high: { badgeClass: "bg-warning/15 text-warning", labelKey: "importance.high" },
  key: { badgeClass: "bg-brand/15 text-brand", labelKey: "importance.key" },
  low: { badgeClass: "border border-border text-muted-foreground", labelKey: "importance.low" },
  medium: { badgeClass: "bg-muted text-muted-foreground", labelKey: "importance.medium" },
} as const satisfies Record<TimelineImportance, ImportanceMeta>;

export function importanceMeta(importance: TimelineImportance) {
  return IMPORTANCE_META[importance];
}
