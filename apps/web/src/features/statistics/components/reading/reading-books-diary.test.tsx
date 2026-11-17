import type { StatisticsCalendarDay } from "@app/shared";

import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen } from "@/test-utils";

import { formatDayLong } from "../../model/statistics-format";
import { calendarDayFixture, statisticsIds } from "../../model/statistics.fixtures";
import { ReadingBooksDiary } from "./reading-books-diary";

const books = messages.statistics.calendar.books;

const translateBooks = createTranslator({
  locale: "uk",
  messages,
  namespace: "statistics.calendar.books",
});

const WIZARD = {
  bookId: statisticsIds.bookId,
  coverThumbUrl: null,
  pagesRead: 25,
  title: "A Wizard of Earthsea",
} as const;

function dayOn(date: string, overrides: Partial<StatisticsCalendarDay> = {}) {
  return calendarDayFixture({ date, drilldown: { date, kind: "reading_day" }, ...overrides });
}

function daySummary(date: string) {
  return translateBooks("daySummary", { books: 1, date: formatDayLong(date, "uk"), pages: 25 });
}

function readingDayOn(date: string) {
  return dayOn(date, { booksCount: 1, booksPreview: [WIZARD], pagesRead: 25 });
}

const MONTH_DAYS = {
  quiet: [dayOn("2026-03-02"), dayOn("2026-03-03")],
  reading: [readingDayOn("2026-03-02"), dayOn("2026-03-03"), readingDayOn("2026-03-15")],
} as const;

function renderDiary(days: readonly StatisticsCalendarDay[], isHistoryUncertain: boolean) {
  return renderWithProviders(
    <ReadingBooksDiary days={days} isHistoryUncertain={isHistoryUncertain} />,
  );
}

describe("ReadingBooksDiary empty month", () => {
  it("shows only the empty-month title when the month history is complete", () => {
    renderDiary(MONTH_DAYS.quiet, false);

    expect(screen.getByText(books.emptyMonth)).toBeInTheDocument();
    expect(screen.queryByText(books.emptyMonthUncertainTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(books.emptyMonthUncertainDescription)).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("explains that records may be missing when the month history is uncertain", () => {
    renderDiary(MONTH_DAYS.quiet, true);

    expect(screen.getByText(books.emptyMonthUncertainTitle)).toBeInTheDocument();
    expect(screen.getByText(books.emptyMonthUncertainDescription)).toBeInTheDocument();
    expect(screen.queryByText(books.emptyMonth)).not.toBeInTheDocument();
  });
});

describe("ReadingBooksDiary reading days", () => {
  it("lists only the reading days, newest first", () => {
    renderDiary(MONTH_DAYS.reading, false);

    const rows = screen.getAllByRole("button");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAccessibleName(daySummary("2026-03-15"));
    expect(rows[1]).toHaveAccessibleName(daySummary("2026-03-02"));
  });

  it("adds one legacy note under the list when the month history is uncertain", () => {
    renderDiary(MONTH_DAYS.reading, true);

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent(books.legacyMonthNote);
  });

  it("adds no legacy note when the month history is complete", () => {
    renderDiary(MONTH_DAYS.reading, false);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
