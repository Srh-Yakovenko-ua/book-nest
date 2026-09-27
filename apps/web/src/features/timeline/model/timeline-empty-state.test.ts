import { describe, expect, it } from "vitest";

import type { TimelineEventsFilterState } from "./timeline-events-query";

import { resolveTimelineEmptyState } from "./timeline-empty-state";
import { createFilterState } from "./timeline-events-query";

function resolve(
  overrides: Partial<TimelineEventsFilterState> = {},
  context: {
    activeTimelineId?: null | string;
    lineCount?: null | number;
    totalEvents?: number;
  } = {},
) {
  const activeTimelineId = context.activeTimelineId ?? null;
  return resolveTimelineEmptyState({
    activeTimelineId,
    filters: { ...createFilterState(activeTimelineId), ...overrides },
    selectedLineEventsCount: context.lineCount ?? null,
    totalEvents: context.totalEvents ?? 12,
  });
}

describe("resolveTimelineEmptyState", () => {
  it("reports an empty book before anything else", () => {
    expect(
      resolve(
        { search: "нічого", withoutChapter: true },
        { activeTimelineId: "line-1", lineCount: 0, totalEvents: 0 },
      ),
    ).toBe("book");
  });

  it("reports an empty line when the selected line has no events at all", () => {
    expect(resolve({}, { activeTimelineId: "line-2", lineCount: 0 })).toBe("line");
  });

  it("keeps the line state for a selected line without any restriction", () => {
    expect(resolve({}, { activeTimelineId: "line-2", lineCount: 4 })).toBe("line");
  });

  it("falls back to the book state in all lines without any restriction", () => {
    expect(resolve()).toBe("book");
  });

  it("celebrates a book where every event has a chapter", () => {
    expect(resolve({ withoutChapter: true })).toBe("withoutChapter");
  });

  it("reports the recap state when only the recap restricts the list", () => {
    expect(resolve({ recap: true })).toBe("recap");
  });

  it("reports the search state when only the search restricts the list", () => {
    expect(resolve({ search: "  дракон  " })).toBe("search");
  });

  it("ignores a blank search", () => {
    expect(resolve({ search: "   " }, { activeTimelineId: "line-2", lineCount: 3 })).toBe("line");
  });

  it("reports the filters state for a facet", () => {
    expect(resolve({ eventType: ["death"] })).toBe("filters");
    expect(resolve({ importance: ["key"] })).toBe("filters");
    expect(resolve({ unresolved: true })).toBe("filters");
  });

  it("reports the filters state when restrictions are mixed", () => {
    expect(resolve({ recap: true, search: "дракон" })).toBe("filters");
    expect(resolve({ search: "дракон", withoutChapter: true })).toBe("filters");
    expect(resolve({ recap: true, withoutChapter: true })).toBe("filters");
    expect(resolve({ eventType: ["death"], search: "дракон" })).toBe("filters");
  });

  it("prefers the restriction states over an empty selected line", () => {
    expect(resolve({ search: "дракон" }, { activeTimelineId: "line-2", lineCount: 0 })).toBe(
      "search",
    );
  });
});
