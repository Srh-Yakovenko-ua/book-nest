import type { StatisticsCalendarDay } from "@app/shared";

import { eachDayOfInterval, formatISO, parseISO } from "date-fns";
import { createTranslator } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { formatDayLong } from "../../model/statistics-format";
import { calendarDayFixture, statisticsIds } from "../../model/statistics.fixtures";
import { ReadingHeatmap } from "./reading-heatmap";

const translateHeatmap = createTranslator({
  locale: "uk",
  messages,
  namespace: "statistics.calendar.heatmap",
});

const translateBooks = createTranslator({
  locale: "uk",
  messages,
  namespace: "statistics.calendar.books",
});

const dayText = messages.statistics.details.day;

const CELL_CLASS = { recordedZero: "bg-secondary", unknown: "ring-1" } as const;

const MONTH_LABEL_CLASS = { selected: "text-primary" } as const;

const OUTSIDE_MONTH = "2025-01";

const QUARTERS = {
  autumn2026: { months: ["2026-10", "2026-11", "2026-12"], today: "2026-11-19" },
  leapWinter2024: { months: ["2024-01", "2024-02", "2024-03"], today: "2024-12-31" },
  summer2026: { months: ["2026-07", "2026-08", "2026-09"], today: "2026-11-19" },
} as const;

const WIZARD = {
  bookId: statisticsIds.bookId,
  coverThumbUrl: null,
  pagesRead: 25,
  title: "A Wizard of Earthsea",
} as const;

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = new URL(String(input), "http://localhost");
  const date = url.pathname.split("/").at(-1) ?? "";
  return Promise.resolve(
    new Response(
      JSON.stringify({
        books: [{ ...WIZARD, bookState: "active" }],
        booksCount: 1,
        date,
        historyQuality: "exact",
        pagesRead: 25,
      }),
      { headers: { "Content-Type": "application/json" }, status: 200 },
    ),
  );
});

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function dayCell(key: "dayEmpty" | "dayUnknown", date: string) {
  return screen.getByRole("img", {
    name: translateHeatmap(key, { date: formatDayLong(date, "uk") }),
  });
}

function dayOn(date: string, overrides: Partial<StatisticsCalendarDay> = {}) {
  return calendarDayFixture({ date, drilldown: { date, kind: "reading_day" }, ...overrides });
}

function futureCell(date: string) {
  return screen.queryByRole("img", {
    name: translateBooks("dayFuture", { date: formatDayLong(date, "uk") }),
  });
}

function quietDaysBetween(start: string, end: string) {
  return eachDayOfInterval({ end: parseISO(end), start: parseISO(start) }).map((day) =>
    dayOn(formatISO(day, { representation: "date" })),
  );
}

function renderQuarter(
  days: readonly StatisticsCalendarDay[],
  quarter: { months: readonly string[]; today: string },
  selectedMonth = OUTSIDE_MONTH,
) {
  return renderWithProviders(
    <ReadingHeatmap
      days={days}
      months={quarter.months}
      selectedMonth={selectedMonth}
      today={quarter.today}
      weekStartDay="monday"
    />,
  );
}

describe("ReadingHeatmap quarter months", () => {
  it("draws each month of the quarter under its own name with every one of its days", () => {
    renderQuarter(quietDaysBetween("2026-07-01", "2026-09-30"), QUARTERS.summer2026);

    expect(screen.getByText("липень")).toBeInTheDocument();
    expect(screen.getByText("серпень")).toBeInTheDocument();
    expect(screen.getByText("вересень")).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(31 + 31 + 30);
  });

  it("marks the name of the books month when the quarter holds it", () => {
    renderQuarter(quietDaysBetween("2026-07-01", "2026-09-30"), QUARTERS.summer2026, "2026-08");

    expect(screen.getByText("серпень")).toHaveClass(MONTH_LABEL_CLASS.selected);
    expect(screen.getByText("липень")).not.toHaveClass(MONTH_LABEL_CLASS.selected);
    expect(screen.getByText("вересень")).not.toHaveClass(MONTH_LABEL_CLASS.selected);
  });

  it("marks no month when the books month lies in another quarter", () => {
    renderQuarter(quietDaysBetween("2026-07-01", "2026-09-30"), QUARTERS.summer2026, "2026-11");

    for (const name of ["липень", "серпень", "вересень"]) {
      expect(screen.getByText(name)).not.toHaveClass(MONTH_LABEL_CLASS.selected);
    }
  });

  it("gives February of a leap year its 29th day", () => {
    renderQuarter(quietDaysBetween("2024-01-01", "2024-03-31"), QUARTERS.leapWinter2024);

    expect(screen.getAllByRole("img")).toHaveLength(31 + 29 + 31);
    expect(dayCell("dayEmpty", "2024-02-29")).toBeInTheDocument();
  });
});

describe("ReadingHeatmap day states", () => {
  it("draws unknown history as an outlined cell without the hatch pattern", () => {
    renderQuarter(
      [
        ...quietDaysBetween("2026-07-01", "2026-07-02"),
        dayOn("2026-07-03", { historyQuality: "legacy_observed_only" }),
        ...quietDaysBetween("2026-07-04", "2026-09-30"),
      ],
      QUARTERS.summer2026,
    );

    const unknown = dayCell("dayUnknown", "2026-07-03");
    const recordedZero = dayCell("dayEmpty", "2026-07-02");
    expect(unknown).toHaveClass(CELL_CLASS.unknown);
    expect(unknown).not.toHaveClass(CELL_CLASS.recordedZero);
    expect(recordedZero).toHaveClass(CELL_CLASS.recordedZero);
    expect(recordedZero).not.toHaveClass(CELL_CLASS.unknown);
    expect(document.body.querySelectorAll(".hatched")).toHaveLength(0);
  });

  it("treats a past day missing from the calendar as unknown history", () => {
    renderQuarter(
      quietDaysBetween("2026-07-01", "2026-09-30").filter((day) => day.date !== "2026-07-04"),
      QUARTERS.summer2026,
    );

    expect(dayCell("dayUnknown", "2026-07-04")).toHaveClass(CELL_CLASS.unknown);
  });

  it("shows the days after today as not yet come rather than as recorded zeros", () => {
    renderQuarter(quietDaysBetween("2026-10-01", "2026-11-19"), QUARTERS.autumn2026);

    expect(dayCell("dayEmpty", "2026-11-19")).toBeInTheDocument();
    expect(futureCell("2026-11-20")).toBeInTheDocument();
    expect(futureCell("2026-12-31")).toBeInTheDocument();
    expect(futureCell("2026-11-20")).not.toHaveClass(CELL_CLASS.recordedZero);
    expect(screen.getAllByRole("img")).toHaveLength(31 + 30 + 31);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("offers a reading day as a button named by its pages and books", () => {
    renderQuarter(
      [
        ...quietDaysBetween("2026-07-01", "2026-07-14"),
        dayOn("2026-07-15", {
          booksCount: 1,
          booksPreview: [WIZARD],
          intensity: 2,
          pagesRead: 25,
        }),
        ...quietDaysBetween("2026-07-16", "2026-09-30"),
      ],
      QUARTERS.summer2026,
    );

    expect(
      screen.getByRole("button", {
        name: translateHeatmap("daySummary", {
          books: 1,
          date: formatDayLong("2026-07-15", "uk"),
          pages: 25,
        }),
      }),
    ).toBeInTheDocument();
  });
});

describe("ReadingHeatmap day popover", () => {
  it("heads the day details with its date and closes from its own button back to the day", async () => {
    const user = userEvent.setup();
    renderQuarter(
      [
        ...quietDaysBetween("2026-07-01", "2026-07-14"),
        dayOn("2026-07-15", { booksCount: 1, booksPreview: [WIZARD], intensity: 2, pagesRead: 25 }),
        ...quietDaysBetween("2026-07-16", "2026-09-30"),
      ],
      QUARTERS.summer2026,
    );
    const date = formatDayLong("2026-07-15", "uk");
    const cell = screen.getByRole("button", {
      name: translateHeatmap("daySummary", { books: 1, date, pages: 25 }),
    });

    await user.click(cell);
    const popover = await screen.findByRole("dialog", { name: date });
    expect(within(popover).getByText(dayText.eyebrow)).toBeInTheDocument();
    await user.click(within(popover).getByRole("button", { name: dayText.close }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(cell).toHaveFocus();
  });
});

describe("ReadingHeatmap legend", () => {
  it("runs from fewer to more pages and leaves out unknown history in a fully recorded quarter", () => {
    renderQuarter(quietDaysBetween("2026-07-01", "2026-09-30"), QUARTERS.summer2026);

    expect(screen.getByText(translateHeatmap("legendLess"))).toBeInTheDocument();
    expect(screen.getByText(translateHeatmap("legendMore"))).toBeInTheDocument();
    expect(screen.queryByText(translateHeatmap("unknownLegend"))).not.toBeInTheDocument();
    expect(screen.queryByText(translateHeatmap("futureLegend"))).not.toBeInTheDocument();
  });

  it("explains upcoming days once the quarter reaches past today", () => {
    renderQuarter(quietDaysBetween("2026-10-01", "2026-11-19"), QUARTERS.autumn2026);

    expect(screen.getByText(translateHeatmap("futureLegend"))).toBeInTheDocument();
  });

  it("explains unknown history once the quarter has an unknown day", () => {
    renderQuarter(
      quietDaysBetween("2026-07-01", "2026-09-30").filter((day) => day.date !== "2026-08-10"),
      QUARTERS.summer2026,
    );

    expect(screen.getByText(translateHeatmap("unknownLegend"))).toBeInTheDocument();
  });
});
