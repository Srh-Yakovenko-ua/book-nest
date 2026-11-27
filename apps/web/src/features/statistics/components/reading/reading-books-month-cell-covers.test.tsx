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

const FALLBACK_ART = /book-covers.*cover-\d\.png/;

const POSTER = { books: "[data-poster-books]", slot: "[data-poster-slot]" } as const;

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

function moreBooks(count: number): string {
  return translateBooks("more", { count });
}

function posterFrame() {
  return document.querySelector(POSTER.books);
}

function posterImages() {
  return document.querySelectorAll("img");
}

function posterSlots(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(POSTER.slot));
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

function slotImageSources(slot: HTMLElement): string[] {
  return Array.from(slot.querySelectorAll("img")).map((image) => image.getAttribute("src") ?? "");
}

describe("ReadingBooksMonthCellCovers poster layout", () => {
  it("renders nothing for a day without a book preview", () => {
    const { container } = renderCovers({ booksCount: 0, booksPreview: [] });

    expect(container).toBeEmptyDOMElement();
  });

  it("fills a one-book day with a single cropped cover and no blurred backdrop", () => {
    renderCovers({ booksCount: 1, booksPreview: [BOOKS.wizard] });

    const slots = posterSlots();
    expect(slots).toHaveLength(1);
    const [slot] = slots;
    if (slot === undefined) throw new Error("no poster slot");
    expect(slotImageSources(slot)).toEqual([BOOKS.wizard.coverThumbUrl]);
    expect(posterImages()[0]).toHaveClass("object-cover");
    expect(posterFrame()).toHaveClass("grid-cols-1");
    expect(screen.queryByText(OVERFLOW_CHIP)).not.toBeInTheDocument();
  });

  it("splits a two-book day into two equal halves in the preview order", () => {
    renderCovers({
      booksCount: 2,
      booksPreview: [BOOKS.wizard, BOOKS.tombs],
    });

    expect(posterSlots().map((slot) => slot.dataset.posterSlot)).toEqual([
      BOOKS.wizard.bookId,
      BOOKS.tombs.bookId,
    ]);
    expect(posterFrame()).toHaveClass("grid-cols-2");
    expect(screen.queryByText(OVERFLOW_CHIP)).not.toBeInTheDocument();
  });

  it("gives the first of three books the tall left slot and adds no count when exactly three were read", () => {
    renderCovers({
      booksCount: 3,
      booksPreview: [BOOKS.wizard, BOOKS.tombs, BOOKS.farthestShore],
    });

    const [lead, top, bottom] = posterSlots();
    expect(lead?.dataset.posterSlot).toBe(BOOKS.wizard.bookId);
    expect(lead).toHaveClass("row-span-2");
    expect(top).not.toHaveClass("row-span-2");
    expect(bottom).not.toHaveClass("row-span-2");
    expect(posterFrame()).toHaveClass("grid-cols-[55fr_45fr]");
    expect(screen.queryByText(OVERFLOW_CHIP)).not.toBeInTheDocument();
  });

  it("shows three previews and counts the other two books of a five-book day", () => {
    renderCovers({
      booksCount: 5,
      booksPreview: [BOOKS.wizard, BOOKS.tombs, BOOKS.farthestShore],
      remainingBooksCount: 2,
    });

    expect(posterSlots()).toHaveLength(3);
    expect(screen.getByText(moreBooks(2))).toBeInTheDocument();
  });

  it("counts every book beyond the drawn previews when the preview is shorter than expected", () => {
    renderCovers({
      booksCount: 4,
      booksPreview: [BOOKS.wizard, BOOKS.tombs],
      remainingBooksCount: 2,
    });

    expect(posterSlots()).toHaveLength(2);
    expect(screen.getByText(moreBooks(2))).toBeInTheDocument();
  });
});

describe("ReadingBooksMonthCellCovers missing covers", () => {
  it("draws fallback cover art without the title when the only book has no cover", () => {
    renderCovers({
      booksCount: 1,
      booksPreview: [{ ...BOOKS.wizard, coverThumbUrl: null }],
    });

    expect(Array.from(posterImages(), (image) => image.getAttribute("src"))).toEqual([
      expect.stringMatching(FALLBACK_ART),
    ]);
    expect(posterSlots()).toHaveLength(1);
    expect(screen.queryByText(BOOKS.wizard.title)).not.toBeInTheDocument();
  });

  it("draws fallback cover art only in the slot whose book has no cover", () => {
    renderCovers({
      booksCount: 2,
      booksPreview: [BOOKS.wizard, { ...BOOKS.tombs, coverThumbUrl: null }],
    });

    const [withCover, withoutCover] = posterSlots();
    if (withCover === undefined || withoutCover === undefined) throw new Error("missing slots");
    expect(slotImageSources(withCover)).toEqual([BOOKS.wizard.coverThumbUrl]);
    expect(slotImageSources(withoutCover)).toEqual([expect.stringMatching(FALLBACK_ART)]);
    expect(screen.queryByText(BOOKS.tombs.title)).not.toBeInTheDocument();
  });
});
