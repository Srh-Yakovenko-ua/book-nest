import { describe, expect, it } from "vitest";

import type { EventFormMessages } from "./event-form-schema";

import {
  buildEventFormSchema,
  eventFormDefaults,
  eventFormNextInBatch,
  eventFormValuesToInput,
} from "./event-form-schema";
import { makeTimelineEventView } from "./timeline.fixtures";

const messages: EventFormMessages = {
  chapterTooLong: "chapter-too-long",
  descriptionTooLong: "description-too-long",
  locationTooLong: "location-too-long",
  pageExceedsBook: "page-exceeds-book",
  pageNotPositive: "page-not-positive",
  personalNoteTooLong: "personal-note-too-long",
  storyTimeTooLong: "story-time-too-long",
  summaryTooLong: "summary-too-long",
  titleEmpty: "title-empty",
  titleTooLong: "title-too-long",
};

function baseValues() {
  return {
    chapter: "",
    description: "",
    eventType: "main",
    importance: "medium",
    isSpoiler: false,
    location: "",
    personalNote: "",
    resolvedByEventId: null,
    storyTime: "",
    summary: "",
    threadStatus: null,
    timelineId: "line-1",
    title: "Геральт зустрічає Йеннефер",
  };
}

function errorFor(data: unknown, field: string, pagesCount: null | number = null) {
  const result = buildEventFormSchema({ messages, pagesCount }).safeParse(data);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("buildEventFormSchema", () => {
  it("accepts a title-only event", () => {
    expect(
      buildEventFormSchema({ messages, pagesCount: null }).safeParse(baseValues()).success,
    ).toBe(true);
  });

  it("rejects an empty title", () => {
    expect(errorFor({ ...baseValues(), title: "   " }, "title")).toBe("title-empty");
  });

  it("rejects a title over the length limit", () => {
    expect(errorFor({ ...baseValues(), title: "x".repeat(151) }, "title")).toBe("title-too-long");
  });

  it("trims the parsed title", () => {
    const result = buildEventFormSchema({ messages, pagesCount: null }).parse({
      ...baseValues(),
      title: "  Геральт  ",
    });
    expect(result.title).toBe("Геральт");
  });

  it("rejects a page below one", () => {
    expect(errorFor({ ...baseValues(), page: 0 }, "page", 100)).toBe("page-not-positive");
  });

  it("rejects a page beyond the known book length", () => {
    expect(errorFor({ ...baseValues(), page: 150 }, "page", 100)).toBe("page-exceeds-book");
  });

  it("accepts a page within the known book length", () => {
    expect(errorFor({ ...baseValues(), page: 100 }, "page", 100)).toBeUndefined();
  });

  it("accepts an omitted page", () => {
    expect(errorFor(baseValues(), "page", 100)).toBeUndefined();
  });

  it("uses the not-positive message when the book length is unknown", () => {
    expect(errorFor({ ...baseValues(), page: 0 }, "page", null)).toBe("page-not-positive");
  });
});

describe("eventFormValuesToInput", () => {
  function parseValues(overrides: Record<string, unknown>) {
    return buildEventFormSchema({ messages, pagesCount: null }).parse({
      ...baseValues(),
      ...overrides,
    });
  }

  it("converts blank optional text fields to null", () => {
    const input = eventFormValuesToInput(parseValues({ chapter: "  ", summary: "" }));
    expect(input.chapter).toBeNull();
    expect(input.summary).toBeNull();
  });

  it("keeps entered optional text and trims it", () => {
    const input = eventFormValuesToInput(parseValues({ storyTime: "  Третій день  " }));
    expect(input.storyTime).toBe("Третій день");
  });

  it("maps an omitted page to a null page number", () => {
    expect(eventFormValuesToInput(parseValues({})).pageNumber).toBeNull();
  });

  it("keeps the resolving event only when the thread is marked resolved", () => {
    const resolved = eventFormValuesToInput(
      parseValues({ resolvedByEventId: "event-9", threadStatus: "resolved" }),
    );
    expect(resolved.resolvedByEventId).toBe("event-9");

    const open = eventFormValuesToInput(
      parseValues({ resolvedByEventId: "event-9", threadStatus: "open" }),
    );
    expect(open.resolvedByEventId).toBeNull();
  });

  it("omits the timeline id when none is selected", () => {
    expect(eventFormValuesToInput(parseValues({ timelineId: null })).timelineId).toBeUndefined();
  });

  it("carries the spoiler flag through unchanged", () => {
    expect(eventFormValuesToInput(parseValues({ isSpoiler: true })).isSpoiler).toBe(true);
    expect(eventFormValuesToInput(parseValues({ isSpoiler: false })).isSpoiler).toBe(false);
  });
});

describe("eventFormDefaults", () => {
  it("starts a new event with the default type, importance and empty title", () => {
    const defaults = eventFormDefaults({ timelineId: "line-1" });
    expect(defaults.eventType).toBe("main");
    expect(defaults.importance).toBe("medium");
    expect(defaults.title).toBe("");
    expect(defaults.timelineId).toBe("line-1");
    expect(defaults.page).toBeUndefined();
    expect(defaults.isSpoiler).toBe(false);
  });

  it("keeps the spoiler flag of an existing event", () => {
    const event = makeTimelineEventView({ isSpoiler: true });
    expect(eventFormDefaults({ event, timelineId: event.timelineId }).isSpoiler).toBe(true);
  });

  it("suggests the current page when the reading position is known", () => {
    const defaults = eventFormDefaults({
      readingPosition: { currentPage: 42, guardDefault: false, positionKnown: true },
      timelineId: "line-1",
    });
    expect(defaults.page).toBe(42);
  });

  it("does not suggest a page when the reading position is unknown", () => {
    const defaults = eventFormDefaults({
      readingPosition: { currentPage: 42, guardDefault: false, positionKnown: false },
      timelineId: "line-1",
    });
    expect(defaults.page).toBeUndefined();
  });

  it("prefills the form from an existing event", () => {
    const event = makeTimelineEventView({
      chapter: "Розділ 3",
      importance: "key",
      pageNumber: 88,
      storyTime: "Ніч",
      title: "Дуель",
    });
    const defaults = eventFormDefaults({ event, timelineId: event.timelineId });
    expect(defaults.title).toBe("Дуель");
    expect(defaults.chapter).toBe("Розділ 3");
    expect(defaults.page).toBe(88);
    expect(defaults.storyTime).toBe("Ніч");
    expect(defaults.importance).toBe("key");
  });
});

describe("eventFormNextInBatch", () => {
  function batchSource(overrides: Record<string, unknown> = {}) {
    return buildEventFormSchema({ messages, pagesCount: null }).parse({
      ...baseValues(),
      chapter: "Розділ 7",
      description: "Довгий опис",
      eventType: "twist",
      importance: "key",
      isSpoiler: true,
      location: "Каер Морен",
      page: 128,
      personalNote: "Моя нотатка",
      resolvedByEventId: "event-9",
      storyTime: "Друга ніч",
      summary: "Короткий підсумок",
      threadStatus: "resolved",
      title: "Перша подія",
      ...overrides,
    });
  }

  it("carries the place in the book into the next entry", () => {
    const next = eventFormNextInBatch(batchSource());
    expect(next.chapter).toBe("Розділ 7");
    expect(next.location).toBe("Каер Морен");
    expect(next.page).toBe(128);
    expect(next.storyTime).toBe("Друга ніч");
    expect(next.timelineId).toBe("line-1");
  });

  it("resets everything unique to a single event", () => {
    const next = eventFormNextInBatch(batchSource());
    const defaults = eventFormDefaults({ timelineId: "line-1" });
    expect(next.title).toBe(defaults.title);
    expect(next.summary).toBe(defaults.summary);
    expect(next.description).toBe(defaults.description);
    expect(next.personalNote).toBe(defaults.personalNote);
    expect(next.importance).toBe(defaults.importance);
    expect(next.isSpoiler).toBe(defaults.isSpoiler);
    expect(next.threadStatus).toBe(defaults.threadStatus);
    expect(next.resolvedByEventId).toBe(defaults.resolvedByEventId);
    expect(next.eventType).toBe(defaults.eventType);
  });

  it("keeps the typed page instead of the page the reading position would suggest", () => {
    const suggested = eventFormDefaults({
      readingPosition: { currentPage: 42, guardDefault: false, positionKnown: true },
      timelineId: "line-1",
    });
    expect(suggested.page).toBe(42);
    expect(eventFormNextInBatch(batchSource()).page).toBe(128);
  });

  it("keeps an omitted page omitted", () => {
    expect(eventFormNextInBatch(batchSource({ page: undefined })).page).toBeUndefined();
  });

  it("keeps a timeline-less form without a timeline", () => {
    expect(eventFormNextInBatch(batchSource({ timelineId: null })).timelineId).toBeNull();
  });
});
