import type {
  CreatedEventRelationView,
  Nullable,
  TimelineEventDetailView,
  TimelineEventPreview,
  TimelineEventRelationEntry,
  TimelineEventView,
  TimelineView,
} from "@app/shared";

import {
  TimelineColorKeySchema,
  TimelineEventTypeSchema,
  TimelineImportanceSchema,
  TimelineRelationTypeSchema,
  TimelineThreadStatusSchema,
} from "@app/shared";

type CreatedRelationRow = {
  createdAt: Date;
  id: string;
  relationType: string;
  sourceEventId: string;
  targetEvent: EventPreviewRow;
  targetEventId: string;
};

type EventDetailRow = EventRow & {
  incomingRelations: (RelationRow & { sourceEvent: EventPreviewRow })[];
  outgoingRelations: (RelationRow & { targetEvent: EventPreviewRow })[];
  resolvedBy: Nullable<EventPreviewRow>;
  resolves: EventPreviewRow[];
};

type EventPreviewRow = {
  bookOrder: number;
  chapter: Nullable<string>;
  id: string;
  pageNumber: Nullable<number>;
  timeline: { name: string };
  timelineId: string;
  title: string;
};

type EventRow = {
  bookId: string;
  bookOrder: number;
  chapter: Nullable<string>;
  createdAt: Date;
  description: Nullable<string>;
  eventType: string;
  id: string;
  importance: string;
  location: Nullable<string>;
  pageNumber: Nullable<number>;
  personalNote: Nullable<string>;
  resolvedByEventId: Nullable<string>;
  storyTime: Nullable<string>;
  summary: Nullable<string>;
  threadStatus: Nullable<string>;
  timeline: { colorKey: Nullable<string>; name: string };
  timelineId: string;
  timelineOrder: number;
  title: string;
  updatedAt: Date;
};

type RelationRow = {
  id: string;
  relationType: string;
};

type TimelineRow = {
  colorKey: Nullable<string>;
  createdAt: Date;
  description: Nullable<string>;
  id: string;
  isDefault: boolean;
  name: string;
  position: number;
  updatedAt: Date;
};

export function toCreatedRelationView(row: CreatedRelationRow): CreatedEventRelationView {
  return {
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    relationType: TimelineRelationTypeSchema.parse(row.relationType),
    sourceEventId: row.sourceEventId,
    target: toEventPreview(row.targetEvent),
    targetEventId: row.targetEventId,
  };
}

export function toEventDetailView(row: EventDetailRow): TimelineEventDetailView {
  return {
    ...toEventView(row),
    relations: {
      incoming: row.incomingRelations.map((relation) =>
        toRelationEntry(relation, relation.sourceEvent, "incoming"),
      ),
      outgoing: row.outgoingRelations.map((relation) =>
        toRelationEntry(relation, relation.targetEvent, "outgoing"),
      ),
    },
    resolvedBy: row.resolvedBy === null ? null : toEventPreview(row.resolvedBy),
    resolves: row.resolves.map(toEventPreview),
  };
}

export function toEventPreview(row: EventPreviewRow): TimelineEventPreview {
  return {
    bookOrder: row.bookOrder,
    chapter: row.chapter,
    id: row.id,
    pageNumber: row.pageNumber,
    timelineId: row.timelineId,
    timelineName: row.timeline.name,
    title: row.title,
  };
}

export function toEventView(row: EventRow): TimelineEventView {
  return {
    bookId: row.bookId,
    bookOrder: row.bookOrder,
    chapter: row.chapter,
    createdAt: row.createdAt.toISOString(),
    description: row.description,
    eventType: TimelineEventTypeSchema.parse(row.eventType),
    id: row.id,
    importance: TimelineImportanceSchema.parse(row.importance),
    location: row.location,
    pageNumber: row.pageNumber,
    personalNote: row.personalNote,
    resolvedByEventId: row.resolvedByEventId,
    storyTime: row.storyTime,
    summary: row.summary,
    threadStatus:
      row.threadStatus === null ? null : TimelineThreadStatusSchema.parse(row.threadStatus),
    timelineColorKey: parseColorKey(row.timeline.colorKey),
    timelineId: row.timelineId,
    timelineName: row.timeline.name,
    timelineOrder: row.timelineOrder,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toTimelineView(timeline: TimelineRow, eventsCount: number): TimelineView {
  return {
    colorKey: parseColorKey(timeline.colorKey),
    createdAt: timeline.createdAt.toISOString(),
    description: timeline.description,
    eventsCount,
    id: timeline.id,
    isDefault: timeline.isDefault,
    name: timeline.name,
    position: timeline.position,
    updatedAt: timeline.updatedAt.toISOString(),
  };
}

function parseColorKey(value: Nullable<string>): TimelineView["colorKey"] {
  return value === null ? null : TimelineColorKeySchema.parse(value);
}

function toRelationEntry(
  relation: RelationRow,
  event: EventPreviewRow,
  direction: TimelineEventRelationEntry["direction"],
): TimelineEventRelationEntry {
  return {
    direction,
    event: toEventPreview(event),
    id: relation.id,
    relationType: TimelineRelationTypeSchema.parse(relation.relationType),
  };
}
