import "@testing-library/jest-dom/vitest";

import type { ComponentProps } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { makeTimelineEventView } from "../model/timeline.fixtures";
import { EventStreamView } from "./event-stream-view";

type StreamProps = ComponentProps<typeof EventStreamView>;

function renderStream(overrides: Partial<StreamProps> = {}) {
  const props: StreamProps = {
    currentPage: null,
    events: [makeTimelineEventView()],
    guardEnabled: false,
    hasNextPage: false,
    isAllLines: true,
    onOpenEvent: vi.fn(),
    onRevealEvent: vi.fn(),
    revealedEventIds: new Set(),
    sort: "book_order",
    ...overrides,
  };
  return { ...renderWithProviders(<EventStreamView {...props} />), props };
}

describe("EventStreamView chapter grouping", () => {
  it("groups the book order by chapter without repeating a chapter across api pages", () => {
    renderStream({
      events: [
        makeTimelineEventView({ chapter: "Розділ 1", id: "a", title: "Подія A" }),
        makeTimelineEventView({ chapter: "Розділ 2", id: "b", title: "Подія Б" }),
        makeTimelineEventView({ chapter: "Розділ 2", id: "c", title: "Подія В" }),
        makeTimelineEventView({ chapter: "Розділ 3", id: "d", title: "Подія Г" }),
      ],
    });

    expect(screen.getAllByText("Розділ 2")).toHaveLength(1);
    expect(screen.getByText("Розділ 1")).toBeInTheDocument();
    expect(screen.getByText("Розділ 3")).toBeInTheDocument();
  });

  it("labels the chapterless group", () => {
    renderStream({ events: [makeTimelineEventView({ chapter: null })] });

    expect(screen.getByText("Без зазначеного розділу")).toBeInTheDocument();
  });

  it("does not group by chapter outside the book order", () => {
    renderStream({ events: [makeTimelineEventView({ chapter: null })], sort: "newest" });

    expect(screen.queryByText("Без зазначеного розділу")).not.toBeInTheDocument();
  });
});

describe("EventStreamView story time dividers", () => {
  it("shows a divider before the first story time and on every change", () => {
    renderStream({
      events: [
        makeTimelineEventView({ id: "a", storyTime: "День перший", title: "Подія A" }),
        makeTimelineEventView({ id: "b", storyTime: "День перший", title: "Подія Б" }),
        makeTimelineEventView({ id: "c", storyTime: "День другий", title: "Подія В" }),
      ],
      isAllLines: false,
      sort: "timeline_order",
    });

    expect(screen.getAllByText("День перший")).toHaveLength(1);
    expect(screen.getAllByText("День другий")).toHaveLength(1);
  });

  it("keeps story time dividers out of the all-lines stream", () => {
    renderStream({
      events: [makeTimelineEventView({ storyTime: "День перший" })],
      isAllLines: true,
      sort: "timeline_order",
    });

    expect(screen.getByText("День перший")).toBeInTheDocument();
    expect(screen.getAllByText("День перший")).toHaveLength(1);
  });

  it("never shows story time dividers outside the timeline order", () => {
    renderStream({
      events: [makeTimelineEventView({ storyTime: "День перший" })],
      isAllLines: false,
      sort: "importance",
    });

    expect(screen.getAllByText("День перший")).toHaveLength(1);
  });
});

describe("EventStreamView reading marker", () => {
  const readingEvents = [
    makeTimelineEventView({ id: "a", pageNumber: 10, title: "Пролог" }),
    makeTimelineEventView({ id: "b", pageNumber: 30, title: "Кульмінація" }),
  ];

  it("marks the reading position before the first event ahead", () => {
    renderStream({ currentPage: 25, events: readingEvents });

    expect(screen.getByText("Ви тут · стор. 25")).toBeInTheDocument();
  });

  it("keeps the marker out of the sorts that are not the book order", () => {
    renderStream({ currentPage: 25, events: readingEvents, sort: "newest" });

    expect(screen.queryByText("Ви тут · стор. 25")).not.toBeInTheDocument();
  });

  it("closes the stream with the marker when every page is loaded", () => {
    renderStream({ currentPage: 100, events: readingEvents, hasNextPage: false });

    expect(screen.getByText("Ви тут · стор. 100")).toBeInTheDocument();
  });

  it("does not fake a marker at the loaded end while more pages exist", () => {
    renderStream({ currentPage: 100, events: readingEvents, hasNextPage: true });

    expect(screen.queryByText("Ви тут · стор. 100")).not.toBeInTheDocument();
  });

  it("stays away while the reading position is unknown", () => {
    renderStream({ currentPage: null, events: readingEvents });

    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
  });
});

describe("EventStreamView spoiler guard", () => {
  it("hides an event that is ahead of the reading position", () => {
    renderStream({
      currentPage: 20,
      events: [makeTimelineEventView({ pageNumber: 90, title: "Таємне вбивство" })],
      guardEnabled: true,
    });

    expect(
      screen.getByText("Подія знаходиться далі вашої поточної позиції читання"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Таємне вбивство" })).not.toBeInTheDocument();
  });

  it("hides a manual spoiler even without a reading position", () => {
    renderStream({
      currentPage: null,
      events: [makeTimelineEventView({ isSpoiler: true, title: "Таємне вбивство" })],
      guardEnabled: true,
    });

    expect(screen.getByText("Подія позначена як спойлер")).toBeInTheDocument();
  });

  it("reports both reasons for a future manual spoiler", () => {
    renderStream({
      currentPage: 20,
      events: [makeTimelineEventView({ isSpoiler: true, pageNumber: 90 })],
      guardEnabled: true,
    });

    expect(screen.getByText("Подія прихована")).toBeInTheDocument();
  });

  it("keeps the summary and context of a guarded event hidden", () => {
    renderStream({
      currentPage: 20,
      events: [
        makeTimelineEventView({
          chapter: "Розділ 9",
          isSpoiler: true,
          summary: "Хтось помирає",
          timelineName: "Флешбеки",
        }),
      ],
      guardEnabled: true,
      isAllLines: true,
      sort: "timeline_order",
    });

    expect(screen.queryByText("Хтось помирає")).not.toBeInTheDocument();
    expect(screen.queryByText("Флешбеки")).not.toBeInTheDocument();
    expect(screen.queryByText("Розділ 9")).not.toBeInTheDocument();
  });

  it("asks the owner to reveal a guarded event", async () => {
    const onRevealEvent = vi.fn();
    renderStream({
      currentPage: 20,
      events: [makeTimelineEventView({ id: "ahead", pageNumber: 90 })],
      guardEnabled: true,
      onRevealEvent,
    });

    await userEvent.click(screen.getByRole("button", { name: "Показати подію" }));

    expect(onRevealEvent).toHaveBeenCalledWith("ahead");
  });

  it("shows a revealed event in full", () => {
    renderStream({
      currentPage: 20,
      events: [makeTimelineEventView({ id: "ahead", pageNumber: 90, title: "Таємне вбивство" })],
      guardEnabled: true,
      revealedEventIds: new Set(["ahead"]),
    });

    expect(screen.getByRole("button", { name: "Таємне вбивство" })).toBeInTheDocument();
  });
});
