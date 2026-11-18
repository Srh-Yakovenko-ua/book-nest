import type { StatisticsCalendarDay } from "@app/shared";

import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen } from "@/test-utils";

import { calendarDayFixture, statisticsIds } from "../../model/statistics.fixtures";
import { ReadingBooksMonthCellCovers } from "./reading-books-month-cell-covers";

const translateBooks = createTranslator({
  locale: "uk",
  messages,
  namespace: "statistics.calendar.books",
});

const OVERFLOW_CHIP = /^\+\d+$/;

const WIDTH_CLASS = {
  oneCover: "@lg/month-grid:block",
  twoCovers: "@2xl/month-grid:block",
  twoCoversHidden: "@2xl/month-grid:hidden",
} as const;

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

const FIVE_BOOK_DAY: Partial<StatisticsCalendarDay> = {
  booksCount: 5,
  booksPreview: [BOOKS.wizard, BOOKS.tombs, BOOKS.farthestShore],
  remainingBooksCount: 2,
};

function moreBooks(count: number): string {
  return translateBooks("more", { count });
}

function renderCovers(overrides: Partial<StatisticsCalendarDay>) {
  return renderWithProviders(
    <ReadingBooksMonthCellCovers
      day={calendarDayFixture({
        date: "2026-03-10",
        drilldown: { date: "2026-03-10", kind: "reading_day" },
        ...overrides,
      })}
    />,
  );
}

describe("ReadingBooksMonthCellCovers", () => {
  it("renders nothing for a day without a book preview", () => {
    const view = renderCovers({ booksCount: 2, remainingBooksCount: 2 });

    expect(view.container).toBeEmptyDOMElement();
  });

  it("shows at most the first two covers of a longer preview", () => {
    renderCovers(FIVE_BOOK_DAY);

    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getByRole("img", { name: BOOKS.wizard.title })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: BOOKS.tombs.title })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: BOOKS.farthestShore.title })).not.toBeInTheDocument();
  });

  it.each([
    { booksPreview: [BOOKS.wizard], hiddenCounts: [], remainingBooksCount: 0, total: 1 },
    {
      booksPreview: [BOOKS.wizard, BOOKS.tombs],
      hiddenCounts: [1],
      remainingBooksCount: 0,
      total: 2,
    },
    {
      booksPreview: [BOOKS.wizard, BOOKS.tombs],
      hiddenCounts: [1, 2],
      remainingBooksCount: 1,
      total: 3,
    },
    {
      booksPreview: [BOOKS.wizard, BOOKS.tombs, BOOKS.farthestShore],
      hiddenCounts: [3, 4],
      remainingBooksCount: 2,
      total: 5,
    },
  ])(
    "counts only the books still hidden at each width for a $total-book day",
    ({ booksPreview, hiddenCounts, remainingBooksCount, total }) => {
      renderCovers({ booksCount: total, booksPreview, remainingBooksCount });

      const chips = screen.queryAllByText(OVERFLOW_CHIP).map((chip) => chip.textContent);
      expect(chips.sort()).toEqual(hiddenCounts.map(moreBooks).sort());
    },
  );

  it("shows the count beside one cover only at the one-cover width", () => {
    renderCovers(FIVE_BOOK_DAY);

    expect(screen.getByText(moreBooks(4))).toHaveClass(
      WIDTH_CLASS.oneCover,
      WIDTH_CLASS.twoCoversHidden,
    );
  });

  it("shows the count beside two covers only from the two-cover width", () => {
    renderCovers(FIVE_BOOK_DAY);

    const chip = screen.getByText(moreBooks(3));
    expect(chip).toHaveClass(WIDTH_CLASS.twoCovers);
    expect(chip).not.toHaveClass(WIDTH_CLASS.oneCover);
  });

  it("drops the one-cover count of a two-book day once both covers fit", () => {
    renderCovers({ booksCount: 2, booksPreview: [BOOKS.wizard, BOOKS.tombs] });

    expect(screen.getByText(moreBooks(1))).toHaveClass(WIDTH_CLASS.twoCoversHidden);
  });
});
