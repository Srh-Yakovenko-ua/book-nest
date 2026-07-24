"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { TIMELINE_VIEW_MODES } from "./timeline-view-mode";

const viewParser = parseAsStringLiteral(TIMELINE_VIEW_MODES);

export function useTimelineUrlState() {
  const [view, setView] = useQueryState("view", viewParser);
  const [timelineId, setTimelineId] = useQueryState("timelineId");

  return { setTimelineId, setView, timelineId, view };
}
