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

const DAY_MARK_CLASS = { intensityTrack: "bg-border", unknownHistory: "hatched" } as const;

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

function cellText(key: "dayEmpty" | "dayFuture" | "dayUnknown", date: string): string {
  return collapseSpaces(translateBooks(key, { date: formatDayLong(date, "uk") }));
}

function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, " ");
}

function dayMarks(scope: HTMLElement, mark: keyof typeof DAY_MARK_CLASS): HTMLElement[] {
  return within(scope)
    .queryAllByRole("generic", { hidden: true })
    .filter((element) => element.classList.contains(DAY_MARK_CLASS[mark]));
}

function dayOn(date: string, overrides: Partial<StatisticsCalendarDay> = {}) {
  return calendarDayFixture({ date, drilldown: { date, kind: "reading_day" }, ...overrides });
}

function daySummary({ books, date, pages }: { books: number; date: string; pages: number }) {
  return translateBooks("daySummary", { books, date: formatDayLong(date, "uk"), pages });
}

function intensityFill(cell: HTMLElement): HTMLElement {
  const [track] = dayMarks(cell, "intensityTrack");
  if (track === undefined) throw new Error("the day shows no intensity meter");
  return within(track).getByRole("generic", { hidden: true });
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

describe("ReadingBooksMonthGrid covers", () => {
  it("shows two covers and counts the other three books of a five-book day", () => {
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
    expect(within(cell).getAllByRole("img")).toHaveLength(2);
    expect(within(cell).getByRole("img", { name: BOOKS.wizard.title })).toBeInTheDocument();
    expect(within(cell).getByRole("img", { name: BOOKS.tombs.title })).toBeInTheDocument();
    expect(within(cell).getByText(translateBooks("more", { count: 3 }))).toBeInTheDocument();
  });

  it("counts the book beyond the preview of a three-book day", () => {
    renderGrid([
      dayOn("2026-03-11", {
        booksCount: 3,
        booksPreview: [BOOKS.wizard, BOOKS.tombs],
        pagesRead: 40,
        remainingBooksCount: 1,
      }),
    ]);

    const cell = screen.getByRole("button", {
      name: daySummary({ books: 3, date: "2026-03-11", pages: 40 }),
    });
    expect(within(cell).getByText(translateBooks("more", { count: 1 }))).toBeInTheDocument();
  });

  it("shows both covers of a two-book day and counts the second only where one cover fits", () => {
    renderGrid([
      dayOn("2026-03-13", {
        booksCount: 2,
        booksPreview: [BOOKS.wizard, BOOKS.tombs],
        pagesRead: 35,
      }),
    ]);

    const cell = screen.getByRole("button", {
      name: daySummary({ books: 2, date: "2026-03-13", pages: 35 }),
    });
    expect(within(cell).getAllByRole("img")).toHaveLength(2);
    expect(within(cell).getAllByText(TEXT_PATTERN.overflowCount)).toHaveLength(1);
    expect(within(cell).getByText(translateBooks("more", { count: 1 }))).toHaveClass(
      "@2xl/month-grid:hidden",
    );
  });

  it("shows no overflow count for a single-book day", () => {
    renderGrid([
      dayOn("2026-03-12", { booksCount: 1, booksPreview: [BOOKS.wizard], pagesRead: 25 }),
    ]);

    const cell = screen.getByRole("button", {
      name: daySummary({ books: 1, date: "2026-03-12", pages: 25 }),
    });
    expect(within(cell).getByRole("img", { name: BOOKS.wizard.title })).toBeInTheDocument();
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

  it("keeps a legacy day with pages as an openable reading day without the unknown mark", () => {
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
    expect(dayMarks(cell, "unknownHistory")).toHaveLength(0);
    expect(screen.queryByText(cellText("dayUnknown", "2026-03-04"))).not.toBeInTheDocument();
  });

  it("hatches a legacy day whose books gained no pages", () => {
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
    expect(dayMarks(cell, "unknownHistory")).toHaveLength(1);
  });

  it("shows the unknown-history square in place of the intensity meter on a legacy day whose books gained no pages", () => {
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
    expect(dayMarks(cell, "unknownHistory")).toHaveLength(1);
    expect(dayMarks(cell, "intensityTrack")).toHaveLength(0);
  });

  it("does not hatch a reliably recorded day whose books gained no pages", () => {
    renderGrid([dayOn("2026-03-04", { booksCount: 1, booksPreview: [BOOKS.wizard] })]);

    const cell = screen.getByRole("button", {
      name: daySummary({ books: 1, date: "2026-03-04", pages: 0 }),
    });
    expect(dayMarks(cell, "unknownHistory")).toHaveLength(0);
  });

  it("shows neither an intensity meter nor an unknown-history square on reliably recorded days without reading", () => {
    const daysUpToToday = eachDayOfInterval({
      end: parseISO(MONTH.today),
      start: parseISO(`${MONTH.key}-01`),
    });
    renderGrid(daysUpToToday.map((date) => dayOn(formatISO(date, { representation: "date" }))));

    expect(screen.getByText(cellText("dayEmpty", "2026-03-06"))).toBeInTheDocument();
    expect(dayMarks(document.body, "unknownHistory")).toHaveLength(0);
    expect(dayMarks(document.body, "intensityTrack")).toHaveLength(0);
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
  it("shows the day number and leaves the pages read to the button name", () => {
    renderGrid([
      dayOn("2026-03-09", { booksCount: 1, booksPreview: [BOOKS.wizard], pagesRead: 48 }),
    ]);

    const cell = screen.getByRole("button", {
      name: daySummary({ books: 1, date: "2026-03-09", pages: 48 }),
    });
    expect(within(cell).getByText("9")).toBeInTheDocument();
    expect(within(cell).queryByText("48")).not.toBeInTheDocument();
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

  it("underlines the number of today only", () => {
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
    expect(within(todayCell).getByText("20")).toHaveClass("underline");
    expect(within(yesterdayCell).getByText("19")).not.toHaveClass("underline");
  });

  it("fills the intensity meter of a reading day to the level of the day", () => {
    renderGrid([
      dayOn("2026-03-10", {
        booksCount: 1,
        booksPreview: [BOOKS.wizard],
        intensity: 3,
        pagesRead: 40,
      }),
    ]);

    const cell = screen.getByRole("button", {
      name: daySummary({ books: 1, date: "2026-03-10", pages: 40 }),
    });
    expect(intensityFill(cell)).toHaveClass("w-3");
  });

  it("keeps an empty intensity meter on a day whose books gained no pages", () => {
    renderGrid([
      dayOn("2026-03-04", { booksCount: 1, booksPreview: [BOOKS.wizard], intensity: 0 }),
    ]);

    const cell = screen.getByRole("button", {
      name: daySummary({ books: 1, date: "2026-03-04", pages: 0 }),
    });
    expect(intensityFill(cell)).toHaveClass("w-0");
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
