import type { ReadingDayDetails as ReadingDayDetailsView } from "@app/shared";
import type { ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import type { SelectableCalendarDay } from "../../model/statistics-calendar";

import { formatDayLong } from "../../model/statistics-format";
import { statisticsIds } from "../../model/statistics.fixtures";
import { ReadingBooksDayPanel } from "./reading-books-day-panel";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    className,
    href,
  }: {
    children: ReactNode;
    className?: string;
    href: string;
  }) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
}));

const books = messages.statistics.calendar.books;

const dayText = messages.statistics.details.day;

const PANEL = {
  bookTitle: "A Wizard of Earthsea",
  id: "reading-books-day-panel",
  selected: { date: "2026-03-10", detailDate: "2026-03-09" },
} as const;

const MONTH_EDGES = {
  first: { date: "2026-03-04", detailDate: "2026-03-04" },
  last: { date: "2026-03-12", detailDate: "2026-03-12" },
} as const;

const MONTH_DAYS: readonly SelectableCalendarDay[] = [
  MONTH_EDGES.first,
  PANEL.selected,
  MONTH_EDGES.last,
];

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

function renderPanel({
  isHistoryUncertain = false,
  onSelectDay = vi.fn(),
  selectableDays = MONTH_DAYS,
  selected = PANEL.selected,
}: {
  isHistoryUncertain?: boolean;
  onSelectDay?: (date: string) => void;
  selectableDays?: readonly SelectableCalendarDay[];
  selected?: null | SelectableCalendarDay;
} = {}) {
  return renderWithProviders(
    <ReadingBooksDayPanel
      id={PANEL.id}
      isHistoryUncertain={isHistoryUncertain}
      onSelectDay={onSelectDay}
      selectableDays={selectableDays}
      selected={selected}
    />,
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ReadingBooksDayPanel selected day", () => {
  it("names the panel after the selected day with a third-level heading", () => {
    renderPanel();

    expect(screen.getByRole("region", selectedDayName)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, ...selectedDayName })).toBeInTheDocument();
  });

  it("carries the id the day buttons point at", () => {
    renderPanel();

    expect(screen.getByRole("region", selectedDayName)).toHaveAttribute("id", PANEL.id);
  });

  it("shows the reading of the selected day's detail date", async () => {
    renderPanel();

    const panel = screen.getByRole("region", selectedDayName);
    expect(await within(panel).findByText(PANEL.bookTitle)).toBeInTheDocument();
  });

  it("sums up the day as a compact list of books and pages", async () => {
    renderPanel();

    const panel = screen.getByRole("region", selectedDayName);
    const terms = await within(panel).findAllByRole("term");
    expect(terms.map((term) => term.textContent)).toEqual([dayText.booksLabel, dayText.pagesLabel]);
    expect(
      within(panel)
        .getAllByRole("definition")
        .map((definition) => definition.textContent),
    ).toEqual(["1 книга", "30 сторінок"]);
  });

  it("lets book titles wrap to two lines instead of cutting them to one", async () => {
    renderPanel();

    const title = await within(screen.getByRole("region", selectedDayName)).findByText(
      PANEL.bookTitle,
    );
    expect(title).toHaveClass("line-clamp-2");
    expect(title).not.toHaveClass("truncate");
  });

  it("links a book still in the library to its page", async () => {
    renderPanel();

    const panel = screen.getByRole("region", selectedDayName);
    expect(
      await within(panel).findByRole("link", { name: new RegExp(PANEL.bookTitle) }),
    ).toHaveAttribute("href", expect.stringContaining(`/books/${statisticsIds.bookId}`));
  });
});

describe("ReadingBooksDayPanel day steps", () => {
  it.each([
    ["previous", books.previousDay, MONTH_EDGES.first.date],
    ["next", books.nextDay, MONTH_EDGES.last.date],
  ] as const)("selects the %s day with books of the month", async (_direction, label, date) => {
    const user = userEvent.setup();
    const onSelectDay = vi.fn();
    renderPanel({ onSelectDay });

    await user.click(screen.getByRole("button", { name: label }));

    expect(onSelectDay).toHaveBeenCalledExactlyOnceWith(date);
  });

  it.each([
    ["first", MONTH_EDGES.first, books.previousDay],
    ["last", MONTH_EDGES.last, books.nextDay],
  ] as const)(
    "disables the outward step on the %s day with books",
    async (_position, day, label) => {
      const user = userEvent.setup();
      const onSelectDay = vi.fn();
      renderPanel({ onSelectDay, selected: day });

      const step = screen.getByRole("button", { name: label });
      expect(step).toHaveAttribute("aria-disabled", "true");
      await user.click(step);
      expect(onSelectDay).not.toHaveBeenCalled();
    },
  );
});

describe("ReadingBooksDayPanel without a selected day", () => {
  it("says plainly that the month has no reading when its history is complete", () => {
    renderPanel({ selected: null });

    expect(screen.getByText(books.dayDetailsTitle)).toBeInTheDocument();
    expect(screen.getByText(books.dayPanelEmpty)).toBeInTheDocument();
    expect(screen.queryByText(books.dayPanelEmptyUncertain)).not.toBeInTheDocument();
    expect(screen.queryByText(books.emptyMonthUncertainDescription)).not.toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("explains that records may be missing when the month history is uncertain", () => {
    renderPanel({ isHistoryUncertain: true, selected: null });

    expect(screen.getByText(books.dayPanelEmptyUncertain)).toBeInTheDocument();
    expect(screen.getByText(books.emptyMonthUncertainDescription)).toBeInTheDocument();
    expect(screen.queryByText(books.dayPanelEmpty)).not.toBeInTheDocument();
  });
});
