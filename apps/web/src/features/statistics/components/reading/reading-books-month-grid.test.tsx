import type { Nullable, StatisticsCalendarDay } from "@app/shared";

import { eachDayOfInterval, formatISO, parseISO } from "date-fns";
import { createTranslator } from "next-intl";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import type { BooksCalendarJumpTarget } from "../../hooks/use-books-calendar-jump";

import { formatDayLong } from "../../model/statistics-format";
import { calendarDayFixture, statisticsIds } from "../../model/statistics.fixtures";
import { ReadingBooksMonthGrid } from "./reading-books-month-grid";

const translateBooks = createTranslator({
  locale: "uk",
  messages,
  namespace: "statistics.calendar.books",
});

const MONTH = { key: "2026-03", today: "2026-03-20" } as const;

const PANEL_ID = "reading-books-day-panel";

const TEXT_PATTERN = { dayNumber: /^\d{1,2}$/, overflowCount: /^\+\d+$/ } as const;

const CELL_TONE_CLASS = {
  empty: "bg-card",
  future: "border-dashed",
  unknown: "bg-secondary/60",
} as const;

const DECORATION_CLASS = { dot: "rounded-full", hatch: "hatched" } as const;

const BOOKS = {
  farthestShore: {
    bookId: "99999999-9999-4999-8999-999999999999",
    coverThumbUrl: "https://covers.test/farthest-shore.jpg",
    pagesRead: 10,
    title: "The Farthest Shore",
  },
  tombs: {
    bookId: statisticsIds.secondBookId,
    coverThumbUrl: "https://covers.test/tombs.jpg",
    pagesRead: 15,
    title: "The Tombs of Atuan",
  },
  wizard: {
    bookId: statisticsIds.bookId,
    coverThumbUrl: "https://covers.test/wizard.jpg",
    pagesRead: 25,
    title: "A Wizard of Earthsea",
  },
} as const;

beforeEach(() => {
  vi.stubGlobal("innerWidth", 1280);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function cellOf(label: string): HTMLElement {
  const cell = screen.getByText(label).parentElement;
  if (cell === null) throw new Error(`no cell holds ${label}`);
  return cell;
}

function cellText(key: "dayEmpty" | "dayFuture" | "dayUnknown", date: string): string {
  return collapseSpaces(translateBooks(key, { date: formatDayLong(date, "uk") }));
}

function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, " ");
}

function dayOn(date: string, overrides: Partial<StatisticsCalendarDay> = {}) {
  return calendarDayFixture({ date, drilldown: { date, kind: "reading_day" }, ...overrides });
}

function daySummary({ books, date, pages }: { books: number; date: string; pages: number }) {
  return translateBooks("daySummary", { books, date: formatDayLong(date, "uk"), pages });
}

function decorations(scope: HTMLElement): HTMLElement[] {
  return within(scope)
    .queryAllByRole("generic", { hidden: true })
    .filter((element) =>
      Object.values(DECORATION_CLASS).some((className) => element.classList.contains(className)),
    );
}

function renderGrid(
  days: StatisticsCalendarDay[],
  {
    jumpTarget,
    onSelectDay = vi.fn(),
    selectedDate = null,
  }: {
    jumpTarget?: BooksCalendarJumpTarget;
    onSelectDay?: (date: string) => void;
    selectedDate?: Nullable<string>;
  } = {},
) {
  return renderWithProviders(
    <ReadingBooksMonthGrid
      days={days}
      jumpTarget={jumpTarget}
      monthKey={MONTH.key}
      onSelectDay={onSelectDay}
      panelId={PANEL_ID}
      selectedDate={selectedDate}
      today={MONTH.today}
      weekStartDay="monday"
    />,
  );
}

describe("ReadingBooksMonthGrid posters", () => {
  it("draws the covers of the day inside its single button and counts the books beyond three", () => {
    renderGrid([
      dayOn("2026-03-10", {
        booksCount: 5,
        booksPreview: [BOOKS.wizard, BOOKS.tombs, BOOKS.farthestShore],
        pagesRead: 50,
        remainingBooksCount: 2,
      }),
    ]);

    const cell = screen.getByRole("button", {
      name: daySummary({ books: 5, date: "2026-03-10", pages: 50 }),
    });
    expect(cell.querySelectorAll("[data-poster-slot]")).toHaveLength(3);
    expect(within(cell).getByText(translateBooks("more", { count: 2 }))).toBeInTheDocument();
    expect(within(cell).queryAllByRole("button")).toHaveLength(0);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("shows no overflow count for a single-book day", () => {
    renderGrid([
      dayOn("2026-03-12", { booksCount: 1, booksPreview: [BOOKS.wizard], pagesRead: 25 }),
    ]);

    const cell = screen.getByRole("button", {
      name: daySummary({ books: 1, date: "2026-03-12", pages: 25 }),
    });
    expect(cell.querySelectorAll("[data-poster-slot]")).toHaveLength(1);
    expect(within(cell).queryByText(TEXT_PATTERN.overflowCount)).not.toBeInTheDocument();
  });

  it("draws no cover for a day that counts books but brought no preview", () => {
    renderGrid([dayOn("2026-03-12", { booksCount: 2, pagesRead: 25 })]);

    const cell = screen.getByRole("button", {
      name: daySummary({ books: 2, date: "2026-03-12", pages: 25 }),
    });
    expect(cell.querySelectorAll("[data-poster-slot]")).toHaveLength(0);
    expect(cell.querySelectorAll("img")).toHaveLength(0);
    expect(within(cell).queryByText(TEXT_PATTERN.overflowCount)).not.toBeInTheDocument();
  });
});

describe("ReadingBooksMonthGrid days without reading", () => {
  it("announces in-month days after today as not yet come and offers no button for them", () => {
    renderGrid([]);

    expect(screen.getByText(cellText("dayFuture", "2026-03-21"))).toBeInTheDocument();
    expect(screen.getByText(cellText("dayFuture", "2026-03-25"))).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("announces past days without a record as unknown rather than as days without reading", () => {
    renderGrid([]);

    expect(screen.getByText(cellText("dayUnknown", "2026-03-05"))).toBeInTheDocument();
    expect(screen.getByText(cellText("dayUnknown", MONTH.today))).toBeInTheDocument();
    expect(screen.queryByText(cellText("dayEmpty", "2026-03-05"))).not.toBeInTheDocument();
    expect(screen.queryByText(cellText("dayFuture", MONTH.today))).not.toBeInTheDocument();
  });

  it("marks a legacy day with no pages as unknown", () => {
    renderGrid([dayOn("2026-03-03", { historyQuality: "legacy_observed_only" })]);

    expect(screen.getByText(cellText("dayUnknown", "2026-03-03"))).toBeInTheDocument();
    expect(screen.queryByText(cellText("dayEmpty", "2026-03-03"))).not.toBeInTheDocument();
  });

  it("marks unknown days without a question-mark glyph", () => {
    renderGrid([dayOn("2026-03-03", { historyQuality: "legacy_observed_only" })]);

    expect(screen.getByText(cellText("dayUnknown", "2026-03-03"))).toBeInTheDocument();
    expect(screen.getByText(cellText("dayUnknown", "2026-03-05"))).toBeInTheDocument();
    expect(screen.queryByText("?")).not.toBeInTheDocument();
  });

  it("keeps a legacy day with pages as an openable poster rather than an unknown day", () => {
    renderGrid([
      dayOn("2026-03-04", {
        booksCount: 1,
        booksPreview: [BOOKS.wizard],
        historyQuality: "legacy_observed_only",
        pagesRead: 30,
      }),
    ]);

    const cell = screen.getByRole("button", {
      name: daySummary({ books: 1, date: "2026-03-04", pages: 30 }),
    });
    expect(within(cell).queryByText("?")).not.toBeInTheDocument();
    expect(cell).not.toHaveClass(CELL_TONE_CLASS.unknown);
    expect(screen.queryByText(cellText("dayUnknown", "2026-03-04"))).not.toBeInTheDocument();
  });

  it("shows a legacy day whose books gained no pages as its covers, with no pages badge or marker", () => {
    renderGrid([
      dayOn("2026-03-04", {
        booksCount: 1,
        booksPreview: [BOOKS.wizard],
        historyQuality: "legacy_observed_only",
      }),
    ]);

    const cell = screen.getByRole("button", {
      name: daySummary({ books: 1, date: "2026-03-04", pages: 0 }),
    });
    expect(cell.querySelectorAll("[data-poster-slot]")).toHaveLength(1);
    expect(
      within(cell).queryByText(translateBooks("pagesShort", { pages: 0 })),
    ).not.toBeInTheDocument();
    expect(decorations(cell)).toHaveLength(0);
  });

  it("draws reliably recorded days without reading in the neutral tone", () => {
    const daysUpToToday = eachDayOfInterval({
      end: parseISO(MONTH.today),
      start: parseISO(`${MONTH.key}-01`),
    });
    renderGrid(daysUpToToday.map((date) => dayOn(formatISO(date, { representation: "date" }))));

    const cell = cellOf(cellText("dayEmpty", "2026-03-06"));
    expect(cell).toHaveClass(CELL_TONE_CLASS.empty);
    expect(cell).not.toHaveClass(CELL_TONE_CLASS.unknown);
    expect(decorations(document.body)).toHaveLength(0);
  });

  it("draws unknown days in the soft unknown tone with no hatch or dot", () => {
    renderGrid([dayOn("2026-03-03", { historyQuality: "legacy_observed_only" })]);

    const legacyZero = cellOf(cellText("dayUnknown", "2026-03-03"));
    const missing = cellOf(cellText("dayUnknown", "2026-03-05"));
    expect(legacyZero).toHaveClass(CELL_TONE_CLASS.unknown);
    expect(missing).toHaveClass(CELL_TONE_CLASS.unknown);
    expect(legacyZero).not.toHaveClass(CELL_TONE_CLASS.empty);
    expect(decorations(document.body)).toHaveLength(0);
  });

  it("draws days after today in the dashed future tone, apart from unknown and empty days", () => {
    renderGrid([]);

    const future = cellOf(cellText("dayFuture", "2026-03-25"));
    expect(future).toHaveClass(CELL_TONE_CLASS.future);
    expect(future).not.toHaveClass(CELL_TONE_CLASS.unknown);
    expect(future).not.toHaveClass(CELL_TONE_CLASS.empty);
  });

  it("announces a reliable zero day as a day without reading and offers no button for it", () => {
    renderGrid([dayOn("2026-03-06")]);

    expect(screen.getByText(cellText("dayEmpty", "2026-03-06"))).toBeInTheDocument();
    expect(screen.queryByText(cellText("dayUnknown", "2026-03-06"))).not.toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("leaves the padding before the 1st and after the 31st empty", () => {
    renderGrid([]);

    expect(screen.getAllByText(TEXT_PATTERN.dayNumber)).toHaveLength(31);
    expect(screen.queryByText(cellText("dayUnknown", "2026-02-28"))).not.toBeInTheDocument();
    expect(screen.queryByText(cellText("dayFuture", "2026-04-01"))).not.toBeInTheDocument();
  });

  it("numbers the days without a leading zero", () => {
    renderGrid([]);

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.queryByText("01")).not.toBeInTheDocument();
    expect(screen.queryByText("09")).not.toBeInTheDocument();
  });
});

describe("ReadingBooksMonthGrid jump target", () => {
  const jumpDays = [
    dayOn("2026-03-06"),
    dayOn("2026-03-10", { booksCount: 1, booksPreview: [BOOKS.wizard], pagesRead: 25 }),
  ];

  it("attaches the jump ref to the button of the target day", () => {
    const ref = createRef<HTMLButtonElement>();
    renderGrid(jumpDays, { jumpTarget: { date: "2026-03-10", ref } });

    const target = screen.getByRole("button", {
      name: daySummary({ books: 1, date: "2026-03-10", pages: 25 }),
    });
    expect(ref.current).toBe(target);
  });

  it("leaves the jump ref empty when the target day has nothing to open", () => {
    const ref = createRef<HTMLButtonElement>();
    renderGrid(jumpDays, { jumpTarget: { date: "2026-03-06", ref } });

    expect(ref.current).toBeNull();
  });
});

describe("ReadingBooksMonthGrid day content", () => {
  it("shows the day number and the pages read that day on the cell", () => {
    renderGrid([
      dayOn("2026-03-09", { booksCount: 1, booksPreview: [BOOKS.wizard], pagesRead: 48 }),
    ]);

    const cell = screen.getByRole("button", {
      name: daySummary({ books: 1, date: "2026-03-09", pages: 48 }),
    });
    expect(within(cell).getByText("9")).toBeInTheDocument();
    expect(within(cell).getByText(translateBooks("pagesShort", { pages: 48 }))).toBeInTheDocument();
  });

  it("shows the pages of a day with pages but no books, with no cover", () => {
    renderGrid([dayOn("2026-03-07", { pagesRead: 20 })]);

    expect(screen.getByText(translateBooks("pagesShort", { pages: 20 }))).toBeInTheDocument();
    expect(document.body.querySelectorAll("[data-poster-slot]")).toHaveLength(0);
  });

  it.each([
    { pages: 1, pagesAndBooks: "1 сторінка, 1 книга" },
    { pages: 2, pagesAndBooks: "2 сторінки, 1 книга" },
    { pages: 5, pagesAndBooks: "5 сторінок, 1 книга" },
    { pages: 1032, pagesAndBooks: "1 032 сторінки, 1 книга" },
  ])("names a day with $pages pages read in its plural form", ({ pages, pagesAndBooks }) => {
    renderGrid([
      dayOn("2026-03-09", { booksCount: 1, booksPreview: [BOOKS.wizard], pagesRead: pages }),
    ]);

    const expectedName = collapseSpaces(`${formatDayLong("2026-03-09", "uk")}: ${pagesAndBooks}`);
    expect(
      screen.getByRole("button", { name: (name) => collapseSpaces(name) === expectedName }),
    ).toBeInTheDocument();
  });

  it("marks today alone as the current date", () => {
    renderGrid([
      dayOn("2026-03-19", { booksCount: 1, booksPreview: [BOOKS.wizard], pagesRead: 25 }),
      dayOn(MONTH.today, { booksCount: 1, booksPreview: [BOOKS.tombs], pagesRead: 15 }),
    ]);

    const todayCell = screen.getByRole("button", {
      name: daySummary({ books: 1, date: MONTH.today, pages: 15 }),
    });
    const yesterdayCell = screen.getByRole("button", {
      name: daySummary({ books: 1, date: "2026-03-19", pages: 25 }),
    });
    expect(todayCell).toHaveAttribute("aria-current", "date");
    expect(yesterdayCell).not.toHaveAttribute("aria-current");
    expect(document.body.querySelectorAll("[aria-current]")).toHaveLength(1);
  });

  it("keeps the selection on the selected day and the current-date mark on today", () => {
    renderGrid(
      [
        dayOn("2026-03-19", { booksCount: 1, booksPreview: [BOOKS.wizard], pagesRead: 25 }),
        dayOn(MONTH.today, { booksCount: 1, booksPreview: [BOOKS.tombs], pagesRead: 15 }),
      ],
      { selectedDate: "2026-03-19" },
    );

    const selected = screen.getByRole("button", { pressed: true });
    expect(selected).toHaveAccessibleName(daySummary({ books: 1, date: "2026-03-19", pages: 25 }));
    expect(selected).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { current: "date" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});

describe("ReadingBooksMonthGrid day selection", () => {
  const readingDays = [
    dayOn("2026-03-10", { booksCount: 1, booksPreview: [BOOKS.wizard], pagesRead: 25 }),
    dayOn("2026-03-11", { booksCount: 1, booksPreview: [BOOKS.tombs], pagesRead: 15 }),
  ];

  const dayButtons = {
    eleventh: { name: daySummary({ books: 1, date: "2026-03-11", pages: 15 }) },
    tenth: { name: daySummary({ books: 1, date: "2026-03-10", pages: 25 }) },
  } as const;

  it("marks only the selected day as pressed", () => {
    renderGrid(readingDays, { selectedDate: "2026-03-11" });

    expect(screen.getByRole("button", dayButtons.eleventh)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", dayButtons.tenth)).toHaveAttribute("aria-pressed", "false");
  });

  it("points every day button at the day panel", () => {
    renderGrid(readingDays);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveAttribute("aria-controls", PANEL_ID);
    expect(buttons[1]).toHaveAttribute("aria-controls", PANEL_ID);
  });

  it("selects the clicked day", async () => {
    const user = userEvent.setup();
    const onSelectDay = vi.fn();
    renderGrid(readingDays, { onSelectDay, selectedDate: "2026-03-11" });

    await user.click(screen.getByRole("button", dayButtons.tenth));

    expect(onSelectDay).toHaveBeenCalledExactlyOnceWith("2026-03-10");
  });

  it("offers no button for a day with pages but no books", () => {
    renderGrid([dayOn("2026-03-07", { pagesRead: 20 })]);

    const summary = collapseSpaces(daySummary({ books: 0, date: "2026-03-07", pages: 20 }));
    expect(screen.getByText(summary)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers no button for a day with books that does not lead to a reading day", () => {
    renderGrid([
      dayOn("2026-03-08", {
        booksCount: 1,
        booksPreview: [BOOKS.wizard],
        drilldown: {
          bookId: statisticsIds.bookId,
          kind: "reading_cycle",
          readingCycleId: statisticsIds.cycleId,
        },
        pagesRead: 12,
      }),
    ]);

    const summary = collapseSpaces(daySummary({ books: 1, date: "2026-03-08", pages: 12 }));
    expect(screen.getByText(summary)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
