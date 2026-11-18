import type { StatisticsCalendarDay } from "@app/shared";

import { eachDayOfInterval, formatISO, parseISO } from "date-fns";
import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen } from "@/test-utils";

import { formatDayLong } from "../../model/statistics-format";
import { calendarDayFixture, statisticsIds } from "../../model/statistics.fixtures";
import { ReadingHeatmap } from "./reading-heatmap";

const translateHeatmap = createTranslator({
  locale: "uk",
  messages,
  namespace: "statistics.calendar.heatmap",
});

const FOCUS_MONTH = { firstDay: "2026-03-01", key: "2026-03", lastDay: "2026-03-31" } as const;

const LAYOUT = {
  columnWidth: 13,
  firstFocusColumnLeft: 440,
  height: 100,
  lastFocusColumnLeft: 504,
  scrollerLeft: 40,
  viewportWidth: 200,
} as const;

const UNKNOWN_HISTORY_CLASS = "hatched";

const WIZARD = {
  bookId: statisticsIds.bookId,
  coverThumbUrl: null,
  pagesRead: 25,
  title: "A Wizard of Earthsea",
} as const;

afterEach(() => {
  vi.restoreAllMocks();
});

function dayOn(date: string, overrides: Partial<StatisticsCalendarDay> = {}) {
  return calendarDayFixture({ date, drilldown: { date, kind: "reading_day" }, ...overrides });
}

function emptyDayCell(date: string) {
  return screen.getByRole("img", {
    name: translateHeatmap("dayEmpty", { date: formatDayLong(date, "uk") }),
  });
}

function heatmapLayoutRect(this: Element): DOMRect {
  const holdsMonthStart = this.contains(emptyDayCell(FOCUS_MONTH.firstDay));
  const holdsMonthEnd = this.contains(emptyDayCell(FOCUS_MONTH.lastDay));
  if (holdsMonthStart && holdsMonthEnd) {
    return new DOMRect(LAYOUT.scrollerLeft, 0, LAYOUT.viewportWidth, LAYOUT.height);
  }
  if (holdsMonthStart) {
    return new DOMRect(LAYOUT.firstFocusColumnLeft, 0, LAYOUT.columnWidth, LAYOUT.height);
  }
  if (holdsMonthEnd) {
    return new DOMRect(LAYOUT.lastFocusColumnLeft, 0, LAYOUT.columnWidth, LAYOUT.height);
  }
  return new DOMRect();
}

function quietDaysBetween(start: string, end: string) {
  return eachDayOfInterval({ end: parseISO(end), start: parseISO(start) }).map((day) =>
    dayOn(formatISO(day, { representation: "date" })),
  );
}

function renderHeatmap(days: readonly StatisticsCalendarDay[], focusMonth?: string) {
  return renderWithProviders(
    <ReadingHeatmap days={days} focusMonth={focusMonth} weekStartDay="monday" />,
  );
}

function stubHeatmapLayout({ contentWidth }: { contentWidth: number }) {
  vi.spyOn(Element.prototype, "scrollWidth", "get").mockReturnValue(contentWidth);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(LAYOUT.viewportWidth);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(heatmapLayoutRect);
}

describe("ReadingHeatmap focus month", () => {
  it("scrolls the weeks once so the last week of the focus month meets the right edge", () => {
    stubHeatmapLayout({ contentWidth: 1000 });
    const scrollTo = vi.spyOn(Element.prototype, "scrollTo");

    renderHeatmap(quietDaysBetween("2026-02-01", "2026-04-30"), FOCUS_MONTH.key);

    expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ behavior: "instant", left: 277 });
  });

  it("leaves the weeks unscrolled when they all fit", () => {
    stubHeatmapLayout({ contentWidth: LAYOUT.viewportWidth });
    const scrollTo = vi.spyOn(Element.prototype, "scrollTo");

    renderHeatmap(quietDaysBetween("2026-02-01", "2026-04-30"), FOCUS_MONTH.key);

    expect(scrollTo).not.toHaveBeenCalled();
  });
});

describe("ReadingHeatmap cells", () => {
  it("hatches a legacy day without pages", () => {
    renderHeatmap([dayOn("2026-03-02", { historyQuality: "legacy_observed_only" })]);

    expect(
      screen.getByRole("img", {
        name: translateHeatmap("dayUnknown", { date: formatDayLong("2026-03-02", "uk") }),
      }),
    ).toHaveClass(UNKNOWN_HISTORY_CLASS);
  });

  it("does not hatch a reliably recorded day without pages", () => {
    renderHeatmap([dayOn("2026-03-03")]);

    expect(emptyDayCell("2026-03-03")).not.toHaveClass(UNKNOWN_HISTORY_CLASS);
  });

  it.each([
    { pages: 1, pagesAndBooks: "1 сторінка, 1 книга" },
    { pages: 2, pagesAndBooks: "2 сторінки, 1 книга" },
    { pages: 5, pagesAndBooks: "5 сторінок, 1 книга" },
  ])("names a day with $pages pages read in its plural form", ({ pages, pagesAndBooks }) => {
    renderHeatmap([
      dayOn("2026-03-04", {
        booksCount: 1,
        booksPreview: [WIZARD],
        intensity: 1,
        pagesRead: pages,
      }),
    ]);

    expect(
      screen.getByRole("button", {
        name: `${formatDayLong("2026-03-04", "uk")}: ${pagesAndBooks}`,
      }),
    ).toBeInTheDocument();
  });
});
