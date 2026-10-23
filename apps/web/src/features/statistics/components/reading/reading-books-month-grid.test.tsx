import type { StatisticsCalendarDay } from "@app/shared";

import { createTranslator } from "next-intl";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, within } from "@/test-utils";

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

const TEXT_PATTERN = { dayNumber: /^\d{2}$/, overflowCount: /^\+\d+$/ } as const;

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
  return translateBooks(key, { date: formatDayLong(date, "uk") }).replace(/\s+/g, " ");
}

function dayOn(date: string, overrides: Partial<StatisticsCalendarDay> = {}) {
  return calendarDayFixture({ date, drilldown: { date, kind: "reading_day" }, ...overrides });
}

function daySummary({ books, date, pages }: { books: number; date: string; pages: number }) {
  return translateBooks("daySummary", { books, date: formatDayLong(date, "uk"), pages });
}

function renderGrid(days: StatisticsCalendarDay[], jumpTarget?: BooksCalendarJumpTarget) {
  return renderWithProviders(
    <ReadingBooksMonthGrid
      days={days}
      jumpTarget={jumpTarget}
      monthKey={MONTH.key}
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

  it("shows both covers of a two-book day without an overflow count", () => {
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
    expect(within(cell).queryByText(TEXT_PATTERN.overflowCount)).not.toBeInTheDocument();
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

    const missingCell = screen.getByText(cellText("dayUnknown", "2026-03-05")).parentElement;
    expect(missingCell).not.toBeNull();
    expect(within(missingCell ?? document.body).getByText("?")).toBeInTheDocument();
    expect(screen.getByText(cellText("dayUnknown", MONTH.today))).toBeInTheDocument();
    expect(screen.queryByText(cellText("dayEmpty", "2026-03-05"))).not.toBeInTheDocument();
    expect(screen.queryByText(cellText("dayFuture", MONTH.today))).not.toBeInTheDocument();
  });

  it("marks a legacy day with no pages as unknown", () => {
    renderGrid([dayOn("2026-03-03", { historyQuality: "legacy_observed_only" })]);

    const cell = screen.getByText(cellText("dayUnknown", "2026-03-03")).parentElement;
    expect(cell).not.toBeNull();
    expect(within(cell ?? document.body).getByText("?")).toBeInTheDocument();
    expect(screen.queryByText(cellText("dayEmpty", "2026-03-03"))).not.toBeInTheDocument();
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
    expect(screen.queryByText(cellText("dayUnknown", "2026-03-04"))).not.toBeInTheDocument();
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
});

describe("ReadingBooksMonthGrid jump target", () => {
  const jumpDays = [
    dayOn("2026-03-06"),
    dayOn("2026-03-10", { booksCount: 1, booksPreview: [BOOKS.wizard], pagesRead: 25 }),
  ];

  it("attaches the jump ref to the button of the target day", () => {
    const ref = createRef<HTMLButtonElement>();
    renderGrid(jumpDays, { date: "2026-03-10", ref });

    const target = screen.getByRole("button", {
      name: daySummary({ books: 1, date: "2026-03-10", pages: 25 }),
    });
    expect(ref.current).toBe(target);
  });

  it("leaves the jump ref empty when the target day has nothing to open", () => {
    const ref = createRef<HTMLButtonElement>();
    renderGrid(jumpDays, { date: "2026-03-06", ref });

    expect(ref.current).toBeNull();
  });
});
