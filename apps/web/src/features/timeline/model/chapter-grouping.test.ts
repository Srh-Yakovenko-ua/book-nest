import { describe, expect, it } from "vitest";

import { groupEventsByChapter } from "./chapter-grouping";
import { makeTimelineEventView } from "./timeline.fixtures";

function eventWithChapter(id: string, chapter: null | string) {
  return makeTimelineEventView({ chapter, id });
}

describe("groupEventsByChapter", () => {
  it("collects events that share a chapter into one group", () => {
    const [first, second] = groupEventsByChapter([
      eventWithChapter("a", "Розділ 1"),
      eventWithChapter("b", "Розділ 1"),
      eventWithChapter("c", "Розділ 2"),
    ]);

    expect(first?.chapter).toBe("Розділ 1");
    expect(second?.chapter).toBe("Розділ 2");
    expect(first?.events.map((event) => event.id)).toEqual(["a", "b"]);
  });

  it("orders groups by the first appearance of each chapter", () => {
    const groups = groupEventsByChapter([
      eventWithChapter("a", "Фінал"),
      eventWithChapter("b", "Пролог"),
      eventWithChapter("c", "Фінал"),
    ]);

    expect(groups.map((group) => group.chapter)).toEqual(["Фінал", "Пролог"]);
    expect(groups[0]?.events.map((event) => event.id)).toEqual(["a", "c"]);
  });

  it("trims chapter names before grouping", () => {
    const groups = groupEventsByChapter([
      eventWithChapter("a", "  Пролог  "),
      eventWithChapter("b", "Пролог"),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.chapter).toBe("Пролог");
  });

  it("buckets missing and blank chapters together under a null chapter", () => {
    const groups = groupEventsByChapter([
      eventWithChapter("a", null),
      eventWithChapter("b", "   "),
      eventWithChapter("c", ""),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.chapter).toBeNull();
    expect(groups[0]?.events.map((event) => event.id)).toEqual(["a", "b", "c"]);
  });

  it("does not normalize spelling or casing between chapters", () => {
    const groups = groupEventsByChapter([
      eventWithChapter("a", "Пролог"),
      eventWithChapter("b", "пролог"),
    ]);

    expect(groups).toHaveLength(2);
  });
});
