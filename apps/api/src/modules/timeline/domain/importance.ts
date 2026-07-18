import type { TimelineImportance } from "@app/shared";

const IMPORTANCE_RANKS: Record<TimelineImportance, number> = {
  high: 2,
  key: 3,
  low: 0,
  medium: 1,
};

export function importanceRank(importance: TimelineImportance): number {
  return IMPORTANCE_RANKS[importance];
}

export function resolveImportanceFilter({
  importance,
  important,
  keyOnly,
}: {
  importance: TimelineImportance[] | undefined;
  important: boolean | undefined;
  keyOnly: boolean | undefined;
}): TimelineImportance[] | undefined {
  if (keyOnly === true) {
    return ["key"];
  }
  if (important === true) {
    return ["high", "key"];
  }
  if (importance !== undefined && importance.length > 0) {
    return importance;
  }
  return undefined;
}
