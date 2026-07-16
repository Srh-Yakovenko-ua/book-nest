import type { Nullable, TimelineOverviewView, TimelineReadingPosition } from "@app/shared";

import {
  TimelineColorKeySchema,
  TimelineEventTypeSchema,
  TimelineImportanceSchema,
} from "@app/shared";

export type OverviewAggregateInput = {
  byImportance: { count: number; importance: string }[];
  byType: { count: number; eventType: string }[];
  chapterDensity: { chapter: Nullable<string>; count: number }[];
  eventsAfterPosition: number;
  eventsBeforePosition: number;
  eventsUnknownPosition: number;
  totalEvents: number;
  unresolvedCount: number;
};

export type OverviewTimelineInput = {
  colorKey: Nullable<string>;
  eventsCount: number;
  id: string;
  name: string;
};

export function buildTimelineOverview({
  aggregate,
  readingPosition,
  timelines,
}: {
  aggregate: OverviewAggregateInput;
  readingPosition: TimelineReadingPosition;
  timelines: OverviewTimelineInput[];
}): TimelineOverviewView {
  return {
    byImportance: aggregate.byImportance.map((row) => ({
      count: row.count,
      importance: TimelineImportanceSchema.parse(row.importance),
    })),
    byTimeline: timelines.map((timeline) => ({
      colorKey: timeline.colorKey === null ? null : TimelineColorKeySchema.parse(timeline.colorKey),
      count: timeline.eventsCount,
      timelineId: timeline.id,
      timelineName: timeline.name,
    })),
    byType: aggregate.byType.map((row) => ({
      count: row.count,
      eventType: TimelineEventTypeSchema.parse(row.eventType),
    })),
    chapterDensity: aggregate.chapterDensity,
    eventsAfterPosition: aggregate.eventsAfterPosition,
    eventsBeforePosition: aggregate.eventsBeforePosition,
    eventsUnknownPosition: aggregate.eventsUnknownPosition,
    readingPosition,
    totalEvents: aggregate.totalEvents,
    unresolvedCount: aggregate.unresolvedCount,
  };
}
