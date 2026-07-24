import type { Nullable } from "@app/shared";

import { z } from "zod";

export const TIMELINE_VIEW_MODES = ["stream", "list", "overview"] as const;

export const TimelineViewModeSchema = z.enum(TIMELINE_VIEW_MODES);

export type TimelineViewMode = z.infer<typeof TimelineViewModeSchema>;

export const DEFAULT_TIMELINE_VIEW_MODE: TimelineViewMode = "stream";

const STORAGE_KEY = "booknest.timeline.view";

export function readTimelineViewMode(): Nullable<TimelineViewMode> {
  if (typeof window === "undefined") return null;
  const parsed = TimelineViewModeSchema.safeParse(window.localStorage.getItem(STORAGE_KEY));
  return parsed.success ? parsed.data : null;
}

export function writeTimelineViewMode(mode: TimelineViewMode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, mode);
}
