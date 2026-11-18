import type { ReadingDayDetails as ReadingDayDetailsView } from "@app/shared";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, within } from "@/test-utils";

import { formatDayLong } from "../../model/statistics-format";
import { statisticsIds } from "../../model/statistics.fixtures";
import { ReadingBooksDayPanel } from "./reading-books-day-panel";

const books = messages.statistics.calendar.books;

const dayText = messages.statistics.details.day;

const PANEL = {
  bookTitle: "A Wizard of Earthsea",
  id: "reading-books-day-panel",
  selected: { date: "2026-03-10", detailDate: "2026-03-09" },
} as const;

const DAY_DETAILS: ReadingDayDetailsView = {
  books: [
    {
      bookId: statisticsIds.bookId,
      bookState: "active",
      coverThumbUrl: null,
      pagesRead: 30,
      title: PANEL.bookTitle,
    },
  ],
  booksCount: 1,
  date: PANEL.selected.detailDate,
  historyQuality: "exact",
  pagesRead: 30,
};

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = new URL(String(input), "http://localhost");
  if (url.pathname.endsWith(`/api/statistics/reading-days/${PANEL.selected.detailDate}`)) {
    return Promise.resolve(
      new Response(JSON.stringify(DAY_DETAILS), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
  }
  return Promise.reject(new Error(`unexpected fetch ${url.href}`));
});

const selectedDayName = { name: formatDayLong(PANEL.selected.date, "uk") } as const;

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ReadingBooksDayPanel selected day", () => {
  it("names the panel after the selected day with a third-level heading", () => {
    renderWithProviders(
      <ReadingBooksDayPanel id={PANEL.id} isHistoryUncertain={false} selected={PANEL.selected} />,
    );

    expect(screen.getByRole("region", selectedDayName)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, ...selectedDayName })).toBeInTheDocument();
  });

  it("carries the id the day buttons point at", () => {
    renderWithProviders(
      <ReadingBooksDayPanel id={PANEL.id} isHistoryUncertain={false} selected={PANEL.selected} />,
    );

    expect(screen.getByRole("region", selectedDayName)).toHaveAttribute("id", PANEL.id);
  });

  it("shows the reading of the selected day's detail date", async () => {
    renderWithProviders(
      <ReadingBooksDayPanel id={PANEL.id} isHistoryUncertain={false} selected={PANEL.selected} />,
    );

    const panel = screen.getByRole("region", selectedDayName);
    expect(await within(panel).findByText(PANEL.bookTitle)).toBeInTheDocument();
  });

  it("sums up the day as a compact list of books and pages", async () => {
    renderWithProviders(
      <ReadingBooksDayPanel id={PANEL.id} isHistoryUncertain={false} selected={PANEL.selected} />,
    );

    const panel = screen.getByRole("region", selectedDayName);
    const terms = await within(panel).findAllByRole("term");
    expect(terms.map((term) => term.textContent)).toEqual([dayText.booksLabel, dayText.pagesLabel]);
    expect(
      within(panel)
        .getAllByRole("definition")
        .map((definition) => definition.textContent),
    ).toEqual(["1", "30"]);
  });

  it("lets book titles wrap to two lines instead of cutting them to one", async () => {
    renderWithProviders(
      <ReadingBooksDayPanel id={PANEL.id} isHistoryUncertain={false} selected={PANEL.selected} />,
    );

    const title = await within(screen.getByRole("region", selectedDayName)).findByText(
      PANEL.bookTitle,
    );
    expect(title).toHaveClass("line-clamp-2");
    expect(title).not.toHaveClass("truncate");
  });
});

describe("ReadingBooksDayPanel without a selected day", () => {
  it("shows only the empty-month title when the month history is complete", () => {
    renderWithProviders(
      <ReadingBooksDayPanel id={PANEL.id} isHistoryUncertain={false} selected={null} />,
    );

    expect(screen.getByText(books.emptyMonth)).toBeInTheDocument();
    expect(screen.queryByText(books.emptyMonthUncertainTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("explains that records may be missing when the month history is uncertain", () => {
    renderWithProviders(<ReadingBooksDayPanel id={PANEL.id} isHistoryUncertain selected={null} />);

    expect(screen.getByText(books.emptyMonthUncertainTitle)).toBeInTheDocument();
    expect(screen.getByText(books.emptyMonthUncertainDescription)).toBeInTheDocument();
    expect(screen.queryByText(books.emptyMonth)).not.toBeInTheDocument();
  });
});
