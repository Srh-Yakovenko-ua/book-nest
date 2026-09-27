import "@testing-library/jest-dom/vitest";

import type { ComponentProps } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { makeTimelineEventView } from "../model/timeline.fixtures";
import { EventListView } from "./event-list-view";

type ListProps = ComponentProps<typeof EventListView>;

function renderList(overrides: Partial<ListProps> = {}) {
  const props: ListProps = {
    currentPage: null,
    events: [makeTimelineEventView()],
    guardEnabled: false,
    isAllLines: true,
    onOpenEvent: vi.fn(),
    onRevealEvent: vi.fn(),
    revealedEventIds: new Set(),
    ...overrides,
  };
  return { ...renderWithProviders(<EventListView {...props} />), props };
}

describe("EventListView", () => {
  it("heads the dense grid with the canonical columns", () => {
    renderList();

    expect(screen.getByText("№")).toBeInTheDocument();
    expect(screen.getByText("Подія")).toBeInTheDocument();
    expect(screen.getByText("Контекст")).toBeInTheDocument();
    expect(screen.getByText("Тип")).toBeInTheDocument();
    expect(screen.getByText("Важливість")).toBeInTheDocument();
    expect(screen.getByText("Часова лінія")).toBeInTheDocument();
  });

  it("drops the timeline column inside a single line", () => {
    renderList({ isAllLines: false });

    expect(screen.queryByText("Часова лінія")).not.toBeInTheDocument();
  });

  it("numbers the flattened events in one running sequence", () => {
    renderList({
      events: [
        makeTimelineEventView({ id: "a", title: "Перша" }),
        makeTimelineEventView({ id: "b", title: "Друга" }),
        makeTimelineEventView({ id: "c", title: "Третя" }),
      ],
    });

    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3.").length).toBeGreaterThan(0);
  });

  it("builds the context from chapter, page, location and story time", () => {
    renderList({
      events: [
        makeTimelineEventView({
          chapter: "Розділ 4",
          location: "Визима",
          pageNumber: 128,
          storyTime: "День третій",
        }),
      ],
    });

    expect(
      screen.getAllByText("Розділ 4 · стор. 128 · Визима · День третій").length,
    ).toBeGreaterThan(0);
  });

  it("opens the event when the row is activated", async () => {
    const onOpenEvent = vi.fn();
    renderList({
      events: [makeTimelineEventView({ id: "event-9", title: "Дуель на мосту" })],
      onOpenEvent,
    });

    await userEvent.click(screen.getByRole("button", { name: "Дуель на мосту" }));

    expect(onOpenEvent).toHaveBeenCalledWith("event-9");
  });

  it("guards a row with its reason and keeps the actions away", () => {
    renderList({
      currentPage: 20,
      events: [makeTimelineEventView({ id: "ahead", pageNumber: 90, title: "Таємне вбивство" })],
      guardEnabled: true,
      renderActions: () => <button type="button">Дії події</button>,
    });

    expect(
      screen.getByText("Подія знаходиться далі вашої поточної позиції читання"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Таємне вбивство")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Дії події" })).not.toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("reveals a guarded row on demand", async () => {
    const onRevealEvent = vi.fn();
    renderList({
      currentPage: 20,
      events: [makeTimelineEventView({ id: "ahead", isSpoiler: true })],
      guardEnabled: true,
      onRevealEvent,
    });

    expect(screen.getByText("Подія позначена як спойлер")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Показати подію" }));

    expect(onRevealEvent).toHaveBeenCalledWith("ahead");
  });

  it("shows a revealed row in full", () => {
    renderList({
      currentPage: 20,
      events: [makeTimelineEventView({ id: "ahead", pageNumber: 90, title: "Таємне вбивство" })],
      guardEnabled: true,
      renderActions: () => <button type="button">Дії події</button>,
      revealedEventIds: new Set(["ahead"]),
    });

    expect(screen.getByRole("button", { name: "Таємне вбивство" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Дії події" })).toBeInTheDocument();
  });
});
