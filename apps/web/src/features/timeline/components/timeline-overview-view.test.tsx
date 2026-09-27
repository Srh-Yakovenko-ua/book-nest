import "@testing-library/jest-dom/vitest";

import type { TimelineOverviewView as TimelineOverview, TimelineView } from "@app/shared";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { makeTimelineOverview, makeTimelineView } from "../model/timeline.fixtures";
import { TimelineOverviewView } from "./timeline-overview-view";

function renderOverview(
  overview: Partial<TimelineOverview> = {},
  timelines: TimelineView[] = [makeTimelineView()],
) {
  const handlers = {
    onSelectImportance: vi.fn(),
    onSelectLine: vi.fn(),
    onSelectType: vi.fn(),
    onSelectWithoutChapter: vi.fn(),
  };

  renderWithProviders(
    <TimelineOverviewView
      {...handlers}
      overview={makeTimelineOverview(overview)}
      timelines={timelines}
    />,
  );

  return handlers;
}

describe("TimelineOverviewView", () => {
  it("summarises totals with their microfacts", () => {
    renderOverview({
      byImportance: [{ count: 4, importance: "key" }],
      chapterDensity: [
        { chapter: "Розділ 1", count: 2 },
        { chapter: "Розділ 2", count: 1 },
        { chapter: null, count: 3 },
      ],
      resolvedCount: 2,
      totalEvents: 6,
      unresolvedCount: 1,
    });

    expect(screen.getByText("Усього подій")).toBeInTheDocument();
    expect(screen.getByText("у 2 розділах")).toBeInTheDocument();
    expect(screen.getByText("2 уже розв’язано")).toBeInTheDocument();
    expect(screen.getByText("Ключові події")).toBeInTheDocument();
    expect(screen.getByText("· 3 події")).toBeInTheDocument();
  });

  it("omits the resolved microfact when nothing is resolved", () => {
    renderOverview({ resolvedCount: 0, unresolvedCount: 2 });

    expect(screen.queryByText(/уже розв’язано/)).not.toBeInTheDocument();
  });

  it("ranks event types by count and paginates the rest", async () => {
    const { onSelectType } = renderOverview({
      byType: [
        { count: 1, eventType: "main" },
        { count: 5, eventType: "death" },
        { count: 4, eventType: "battle" },
        { count: 3, eventType: "romance" },
        { count: 2, eventType: "travel" },
        { count: 0, eventType: "magic" },
      ],
    });

    expect(screen.getByRole("button", { name: /Смерть персонажа/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Основна подія/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Магічна подія/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Наступні" }));

    expect(screen.getByRole("button", { name: /Основна подія/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Основна подія/ }));

    expect(onSelectType).toHaveBeenCalledWith("main");
  });

  it("always shows the four importance levels and drills into one", async () => {
    const { onSelectImportance } = renderOverview({
      byImportance: [{ count: 2, importance: "key" }],
    });

    for (const label of [/Ключова/, /Висока/, /Середня/, /Низька/]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }

    await userEvent.click(screen.getByRole("button", { name: /Висока/ }));

    expect(onSelectImportance).toHaveBeenCalledWith("high");
  });

  it("lists the timelines from the timeline query including empty ones", async () => {
    const timelines = [0, 1, 2, 3, 4].map((index) =>
      makeTimelineView({
        eventsCount: index,
        id: `line-${index}`,
        isDefault: index === 0,
        name: `Лінія ${index}`,
        position: index,
      }),
    );

    const { onSelectLine } = renderOverview({}, timelines);

    expect(screen.getByRole("button", { name: /Лінія 0/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Лінія 4/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Лінія 1/ }));

    expect(onSelectLine).toHaveBeenCalledWith("line-1");
  });

  it("ranks named chapters and offers the chapterless footer", async () => {
    const { onSelectWithoutChapter } = renderOverview({
      chapterDensity: [
        { chapter: null, count: 4 },
        { chapter: "Розділ 1", count: 1 },
        { chapter: "Розділ 2", count: 3 },
      ],
    });

    expect(screen.getByText("Розділ 2")).toBeInTheDocument();
    expect(screen.getByText("Розділ 1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Без зазначеного розділу: 4 подій" }));

    expect(onSelectWithoutChapter).toHaveBeenCalledTimes(1);
  });

  it("hides the chapterless footer when every event has a chapter", () => {
    renderOverview({ chapterDensity: [{ chapter: "Розділ 1", count: 2 }] });

    expect(screen.queryByText(/Без зазначеного розділу/)).not.toBeInTheDocument();
  });
});
