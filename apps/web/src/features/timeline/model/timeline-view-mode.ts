import type { Nullable } from "@app/shared";

import { z } from "zod";

export const TIMELINE_EVENT_VIEW_MODES = ["stream", "list"] as const;

export const TIMELINE_VIEW_MODES = [...TIMELINE_EVENT_VIEW_MODES, "overview"] as const;

export const TimelineEventViewModeSchema = z.enum(TIMELINE_EVENT_VIEW_MODES);

export type TimelineEventViewMode = z.infer<typeof TimelineEventViewModeSchema>;

export type TimelineViewMode = (typeof TIMELINE_VIEW_MODES)[number];

export const DEFAULT_TIMELINE_VIEW_MODE: TimelineEventViewMode = "stream";

const STORAGE_KEY = "booknest.timeline.view";

export function readTimelineViewMode(): Nullable<TimelineEventViewMode> {
  if (typeof window === "undefined") return null;
  const parsed = TimelineEventViewModeSchema.safeParse(window.localStorage.getItem(STORAGE_KEY));
  return parsed.success ? parsed.data : null;
}

export function writeTimelineViewMode(mode: TimelineEventViewMode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, mode);
}
