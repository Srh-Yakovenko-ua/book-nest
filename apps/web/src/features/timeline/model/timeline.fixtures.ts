import type {
  Paginator,
  TimelineEventDetailView,
  TimelineEventPreview,
  TimelineEventRelationEntry,
  TimelineEventView,
  TimelineListView,
  TimelineOverviewView,
  TimelineReadingPosition,
  TimelineSummaryView,
  TimelineView,
} from "@app/shared";

export function makeEventsPage(
  items: TimelineEventView[],
  overrides: Partial<Paginator<TimelineEventView>> = {},
): Paginator<TimelineEventView> {
  return {
    items,
    page: 1,
    pagesCount: 1,
    pageSize: 50,
    totalCount: items.length,
    ...overrides,
  };
}

export function makeReadingPosition(
  overrides: Partial<TimelineReadingPosition> = {},
): TimelineReadingPosition {
  return {
    currentPage: null,
    guardDefault: false,
    positionKnown: false,
    ...overrides,
  };
}

export function makeTimelineEventDetailView(
  overrides: Partial<TimelineEventDetailView> = {},
): TimelineEventDetailView {
  return {
    ...makeTimelineEventView(),
    relations: { incoming: [], outgoing: [] },
    resolvedBy: null,
    resolves: [],
    ...overrides,
  };
}

export function makeTimelineEventPreview(
  overrides: Partial<TimelineEventPreview> = {},
): TimelineEventPreview {
  return {
    bookOrder: 1,
    chapter: null,
    id: "preview-1",
    pageNumber: null,
    timelineId: "line-1",
    timelineName: "Основна лінія",
    title: "Пов’язана подія",
    ...overrides,
  };
}

export function makeTimelineEventRelationEntry(
  overrides: Partial<TimelineEventRelationEntry> = {},
): TimelineEventRelationEntry {
  return {
    direction: "outgoing",
    event: makeTimelineEventPreview(),
    id: "relation-1",
    relationType: "related",
    ...overrides,
  };
}

export function makeTimelineEventView(
  overrides: Partial<TimelineEventView> = {},
): TimelineEventView {
  return {
    bookId: "book-1",
    bookOrder: 0,
    chapter: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    description: null,
    eventType: "main",
    id: "event-1",
    importance: "medium",
    location: null,
    pageNumber: null,
    personalNote: null,
    resolvedByEventId: null,
    storyTime: null,
    summary: null,
    threadStatus: null,
    timelineColorKey: null,
    timelineId: "line-1",
    timelineName: "Основна лінія",
    timelineOrder: 0,
    title: "Геральт прибуває до Визими",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeTimelineListView(overrides: Partial<TimelineListView> = {}): TimelineListView {
  return {
    timelines: [makeTimelineView()],
    ...overrides,
  };
}

export function makeTimelineOverview(
  overrides: Partial<TimelineOverviewView> = {},
): TimelineOverviewView {
  return {
    byImportance: [{ count: 3, importance: "medium" }],
    byTimeline: [{ colorKey: null, count: 3, timelineId: "line-1", timelineName: "Основна лінія" }],
    byType: [{ count: 3, eventType: "main" }],
    chapterDensity: [{ chapter: null, count: 3 }],
    eventsAfterPosition: 0,
    eventsBeforePosition: 0,
    eventsUnknownPosition: 3,
    readingPosition: makeReadingPosition(),
    totalEvents: 3,
    unresolvedCount: 0,
    ...overrides,
  };
}

export function makeTimelineSummary(
  overrides: Partial<TimelineSummaryView> = {},
): TimelineSummaryView {
  return {
    timelines: [{ eventsCount: 3, timelineId: "line-1" }],
    totalEvents: 3,
    ...overrides,
  };
}

export function makeTimelineView(overrides: Partial<TimelineView> = {}): TimelineView {
  return {
    colorKey: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    description: null,
    eventsCount: 3,
    id: "line-1",
    isDefault: true,
    name: "Основна лінія",
    position: 0,
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
