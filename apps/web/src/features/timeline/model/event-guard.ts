import type { Nullable } from "@app/shared";

import { isEventAhead } from "./reading-position";

export type EventGuardReason = "both" | "future" | "manual";

type EventGuardInput = {
  currentPage: Nullable<number>;
  event: GuardableEvent;
  guardEnabled: boolean;
};

type GuardableEvent = {
  isSpoiler: boolean;
  pageNumber: Nullable<number>;
};

export const GUARD_REASON_LABEL_KEYS = {
  both: "guarded.reasonBoth",
  future: "guarded.reasonFuture",
  manual: "guarded.reasonManual",
} as const satisfies Record<EventGuardReason, string>;

export function eventGuardReason({
  currentPage,
  event,
  guardEnabled,
}: EventGuardInput): Nullable<EventGuardReason> {
  if (!guardEnabled) return null;

  const isAhead = isEventAhead(event, currentPage);
  if (event.isSpoiler) return isAhead ? "both" : "manual";
  return isAhead ? "future" : null;
}
