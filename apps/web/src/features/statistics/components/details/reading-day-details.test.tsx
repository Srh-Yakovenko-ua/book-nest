import type { ReadingDayDetails as ReadingDayDetailsView } from "@app/shared";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { statisticsIds } from "../../model/statistics.fixtures";
import { ReadingDayDetails } from "./reading-day-details";

const dayText = messages.statistics.details.day;

const calendarAction = { name: dayText.showInBooksCalendar } as const;

const DAY = {
  bookTitle: "A Wizard of Earthsea",
  date: "2026-03-10",
} as const;

const DAY_DETAILS: ReadingDayDetailsView = {
  books: [
    {
      bookId: statisticsIds.bookId,
      bookState: "active",
      coverThumbUrl: null,
      pagesRead: 30,
      title: DAY.bookTitle,
    },
  ],
  booksCount: 1,
  date: DAY.date,
  historyQuality: "exact",
  pagesRead: 30,
};

let dayResponse: () => Response = () => jsonResponse(DAY_DETAILS);

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = new URL(String(input), "http://localhost");
  if (url.pathname.endsWith(`/api/statistics/reading-days/${DAY.date}`)) {
    return Promise.resolve(dayResponse());
  }
  return Promise.reject(new Error(`unexpected fetch ${url.href}`));
});

beforeEach(() => {
  dayResponse = () => jsonResponse(DAY_DETAILS);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

describe("ReadingDayDetails calendar action", () => {
  it("offers no calendar action when no handler is given", async () => {
    renderWithProviders(<ReadingDayDetails date={DAY.date} />);

    expect(await screen.findByText(DAY.bookTitle)).toBeInTheDocument();
    expect(screen.queryByRole("button", calendarAction)).not.toBeInTheDocument();
  });

  it("offers the calendar action only once the day has loaded", async () => {
    renderWithProviders(<ReadingDayDetails date={DAY.date} onShowInBooksCalendar={vi.fn()} />);

    expect(screen.getByRole("status", { name: dayText.loading })).toBeInTheDocument();
    expect(screen.queryByRole("button", calendarAction)).not.toBeInTheDocument();
    expect(await screen.findByRole("button", calendarAction)).toBeInTheDocument();
  });

  it("keeps the calendar action hidden when the day fails to load", async () => {
    dayResponse = () => jsonResponse({ message: "boom", statusCode: 500 }, 500);
    renderWithProviders(<ReadingDayDetails date={DAY.date} onShowInBooksCalendar={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(dayText.error);
    expect(screen.queryByRole("button", calendarAction)).not.toBeInTheDocument();
  });

  it("calls the handler once when the calendar action is clicked", async () => {
    const user = userEvent.setup();
    const onShowInBooksCalendar = vi.fn();
    renderWithProviders(
      <ReadingDayDetails date={DAY.date} onShowInBooksCalendar={onShowInBooksCalendar} />,
    );

    await user.click(await screen.findByRole("button", calendarAction));

    expect(onShowInBooksCalendar).toHaveBeenCalledOnce();
  });
});

describe("ReadingDayDetails panel variant", () => {
  it("lists the day totals as books and pages terms", async () => {
    renderWithProviders(<ReadingDayDetails date={DAY.date} variant="panel" />);

    const terms = await screen.findAllByRole("term");
    expect(terms.map((term) => term.textContent)).toEqual([dayText.booksLabel, dayText.pagesLabel]);
    expect(screen.getAllByRole("definition").map((definition) => definition.textContent)).toEqual([
      "1",
      "30",
    ]);
  });

  it("lets book titles wrap to two lines", async () => {
    renderWithProviders(<ReadingDayDetails date={DAY.date} variant="panel" />);

    const title = await screen.findByText(DAY.bookTitle);
    expect(title).toHaveClass("line-clamp-2");
    expect(title).not.toHaveClass("truncate");
  });

  it("keeps book titles on one cut-off line without the variant", async () => {
    renderWithProviders(<ReadingDayDetails date={DAY.date} />);

    const title = await screen.findByText(DAY.bookTitle);
    expect(title).toHaveClass("truncate");
    expect(title).not.toHaveClass("line-clamp-2");
  });
});

describe("ReadingDayDetails book pages", () => {
  it("counts each book's pages in the matching plural form", async () => {
    dayResponse = () =>
      jsonResponse({
        ...DAY_DETAILS,
        books: [
          {
            bookId: statisticsIds.bookId,
            bookState: "active",
            coverThumbUrl: null,
            pagesRead: 1,
            title: DAY.bookTitle,
          },
          {
            bookId: statisticsIds.secondBookId,
            bookState: "active",
            coverThumbUrl: null,
            pagesRead: 2,
            title: "The Tombs of Atuan",
          },
          {
            bookId: "99999999-9999-4999-8999-999999999999",
            bookState: "active",
            coverThumbUrl: null,
            pagesRead: 5,
            title: "The Farthest Shore",
          },
        ],
        booksCount: 3,
        pagesRead: 8,
      });
    renderWithProviders(<ReadingDayDetails date={DAY.date} />);

    expect(await screen.findByText("1 сторінка")).toBeInTheDocument();
    expect(screen.getByText("2 сторінки")).toBeInTheDocument();
    expect(screen.getByText("5 сторінок")).toBeInTheDocument();
  });
});
