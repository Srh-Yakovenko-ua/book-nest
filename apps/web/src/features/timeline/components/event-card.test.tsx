import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { makeTimelineEventView } from "../model/timeline.fixtures";
import { EventCard } from "./event-card";

describe("EventCard", () => {
  it("shows the title, type and importance labels", () => {
    renderWithProviders(
      <EventCard
        event={makeTimelineEventView({ importance: "key", title: "Битва під Содденом" })}
        onOpen={vi.fn()}
        showTimelineName={false}
      />,
    );

    expect(screen.getByText("Битва під Содденом")).toBeInTheDocument();
    expect(screen.getByText("Основна подія")).toBeInTheDocument();
    expect(screen.getByText("Ключова")).toBeInTheDocument();
  });

  it("opens the event when the card is activated", async () => {
    const onOpen = vi.fn();
    renderWithProviders(
      <EventCard
        event={makeTimelineEventView({ id: "event-7", title: "Дуель на мосту" })}
        onOpen={onOpen}
        showTimelineName={false}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Дуель на мосту" }));

    expect(onOpen).toHaveBeenCalledWith("event-7");
  });

  it("renders the page and story time in the meta row", () => {
    renderWithProviders(
      <EventCard
        event={makeTimelineEventView({ pageNumber: 128, storyTime: "Третій день подорожі" })}
        onOpen={vi.fn()}
        showTimelineName={false}
      />,
    );

    expect(screen.getByText("128")).toBeInTheDocument();
    expect(screen.getByText("Третій день подорожі")).toBeInTheDocument();
  });

  it("marks an open thread with a badge", () => {
    renderWithProviders(
      <EventCard
        event={makeTimelineEventView({ threadStatus: "open" })}
        onOpen={vi.fn()}
        showTimelineName={false}
      />,
    );

    expect(screen.getByText("Відкрите питання")).toBeInTheDocument();
  });

  it("marks a resolved thread with a badge", () => {
    renderWithProviders(
      <EventCard
        event={makeTimelineEventView({ threadStatus: "resolved" })}
        onOpen={vi.fn()}
        showTimelineName={false}
      />,
    );

    expect(screen.getByText("Розв’язано")).toBeInTheDocument();
  });

  it("shows the timeline name only in the multi-line layout", () => {
    const event = makeTimelineEventView({ timelineName: "Флешбеки" });
    const { rerender } = renderWithProviders(
      <EventCard event={event} onOpen={vi.fn()} showTimelineName={false} />,
    );

    expect(screen.queryByText("Флешбеки")).not.toBeInTheDocument();

    rerender(<EventCard event={event} onOpen={vi.fn()} showTimelineName />);

    expect(screen.getByText("Флешбеки")).toBeInTheDocument();
  });

  it("keeps the action control visible without hovering", () => {
    renderWithProviders(
      <EventCard
        actions={<button type="button">Дії події</button>}
        event={makeTimelineEventView()}
        onOpen={vi.fn()}
        showTimelineName={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Дії події" })).toBeInTheDocument();
  });
});
