import type {
  Nullable,
  ReadingStatisticsActivityPage,
  ReadingStatisticsCalendarSection,
  ReadingStatisticsMeta,
  StatisticsCalendarDay,
} from "@app/shared";

import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { getStatisticsControllerGetReadingActivityQueryKey } from "@/shared/api/generated/endpoints/statistics/statistics";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import type { CalendarMode } from "../../model/statistics-view";

import { invalidateStatisticsQueries } from "../../api/statistics-keys";
import { formatMonthKey } from "../../model/statistics-format";
import {
  calendarDayFixture,
  calendarFixture,
  overviewFixture,
  readingDayDetailsFixture,
  statisticsIds,
} from "../../model/statistics.fixtures";
import { ReadingCalendarCard } from "./reading-calendar-card";

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

const onModeChange = vi.fn<(mode: CalendarMode) => void>();

const onMonthChange = vi.fn<(month: Nullable<string>) => void>();

const { meta } = overviewFixture();

const calendarText = messages.statistics.calendar;

let monthBooksResponse: () => Promise<Response> = () =>
  Promise.resolve(jsonResponse(activityPage()));

function activityPage(
  overrides: Partial<ReadingStatisticsActivityPage> = {},
): ReadingStatisticsActivityPage {
  return {
    activeDays: 2,
    booksCount: 5,
    historyQuality: "exact",
    items: [],
    nextCursor: null,
    pagesRead: 184,
    range: { from: "2026-03-01", to: "2026-03-31" },
    reliableFrom: "2026-01-01",
    ...overrides,
  };
}

function activityRequests(): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === "/api/statistics/reading-activity");
}

function calendarCard({
  calendar = calendarFixture(),
  cardMeta = meta,
  mode = "activity",
  month = null,
}: {
  calendar?: ReadingStatisticsCalendarSection;
  cardMeta?: ReadingStatisticsMeta;
  mode?: CalendarMode;
  month?: Nullable<string>;
} = {}) {
  return (
    <ReadingCalendarCard
      calendar={calendar}
      meta={cardMeta}
      mode={mode}
      month={month}
      onModeChange={onModeChange}
      onMonthChange={onMonthChange}
    />
  );
}

function dayRequests(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes("/api/statistics/reading-days/"));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function monthStat(label: string): Nullable<Element> {
  return screen.getByText(label).nextElementSibling;
}

beforeEach(() => {
  monthBooksResponse = () => Promise.resolve(jsonResponse(activityPage()));
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input) => {
    if (String(input).includes("/api/statistics/reading-days/")) {
      return Promise.resolve(jsonResponse(readingDayDetailsFixture()));
    }
    if (String(input).includes("/api/statistics/reading-activity")) {
      return monthBooksResponse();
    }
    return Promise.reject(new Error(`unexpected fetch: ${String(input)}`));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ReadingCalendarCard", () => {
  it("renders the books month grid from the overview previews without one request per day", async () => {
    const { queryClient } = renderWithProviders(calendarCard({ mode: "books" }));

    expect(screen.getByText("+3")).toBeInTheDocument();
    await waitFor(() => expect(activityRequests()).toHaveLength(1));
    expect(dayRequests()).toHaveLength(0);
    expect(
      queryClient.isFetching({
        predicate: (query) => String(query.queryKey[0]).includes("/reading-days/"),
      }),
    ).toBe(0);
  });

  it("asks the owner to switch to books by day when the reader picks that mode", async () => {
    renderWithProviders(calendarCard());

    await userEvent.click(screen.getByRole("radio", { name: calendarText.modes.books }));

    expect(onModeChange).toHaveBeenCalledWith("books");
  });

  it("loads the full day only after the reader opens one", async () => {
    renderWithProviders(calendarCard());

    await userEvent.click(screen.getByRole("button", { name: /2 березня 2026/ }));

    await waitFor(() => expect(dayRequests()).toHaveLength(1));
    expect(dayRequests()[0]).toContain("2026-03-02");
    expect(await screen.findByText("Видалена книга")).toBeInTheDocument();
    expect(screen.getByText("Книгу видалено з бібліотеки")).toBeInTheDocument();
  });

  it("leaves the habit stats to the habits section instead of repeating them above the grid", () => {
    renderWithProviders(calendarCard());

    expect(screen.getByText("Читацький календар")).toBeInTheDocument();
    expect(screen.queryByText("Найдовша серія")).not.toBeInTheDocument();
    expect(screen.queryByText("Найактивніший день тижня")).not.toBeInTheDocument();
  });

  it("says explicitly when the drawn range is narrower than the measured one", () => {
    renderWithProviders(calendarCard());

    expect(screen.getByText(/Календар показує/)).toBeInTheDocument();
    expect(screen.getByText(/Показники за/)).toBeInTheDocument();
  });

  it("renders an unavailable calendar with its reason instead of an empty grid", () => {
    renderWithProviders(
      calendarCard({
        calendar: calendarFixture({
          activeDays: 0,
          availability: "unavailable",
          days: [],
          reason: "NO_ACTIVITY_HISTORY",
        }),
      }),
    );

    expect(screen.getByText("Календар недоступний")).toBeInTheDocument();
    expect(screen.getByText("Ще немає жодного запису про прочитані сторінки.")).toBeInTheDocument();
  });

  it("orders the heatmap weekdays by the resolved week start", () => {
    const { unmount } = renderWithProviders(calendarCard());

    expect(screen.getAllByText("пн").length).toBeGreaterThan(0);
    unmount();

    renderWithProviders(calendarCard({ cardMeta: { ...meta, weekStartDay: "sunday" } }));

    expect(screen.getAllByText("нд").length).toBeGreaterThan(0);
  });
});

describe("ReadingCalendarCard month books count", () => {
  const books = calendarText.books;

  function uncappedCalendar(
    firstDayQuality: StatisticsCalendarDay["historyQuality"] = "exact",
  ): ReadingStatisticsCalendarSection {
    return calendarFixture({
      days: [
        calendarDayFixture({
          booksCount: 2,
          booksPreview: [
            { bookId: statisticsIds.bookId, coverThumbUrl: null, pagesRead: 80, title: "A" },
            { bookId: statisticsIds.secondBookId, coverThumbUrl: null, pagesRead: 44, title: "B" },
          ],
          date: "2026-03-02",
          drilldown: { date: "2026-03-02", kind: "reading_day" },
          historyQuality: firstDayQuality,
          intensity: 3,
          pagesRead: 124,
        }),
        calendarDayFixture({
          booksCount: 1,
          booksPreview: [
            { bookId: statisticsIds.bookId, coverThumbUrl: null, pagesRead: 60, title: "A" },
          ],
          date: "2026-03-03",
          drilldown: { date: "2026-03-03", kind: "reading_day" },
          intensity: 2,
          pagesRead: 60,
        }),
      ],
    });
  }

  it("shows the observed distinct books without asking the server when no day hides books", () => {
    const { queryClient } = renderWithProviders(
      calendarCard({ calendar: uncappedCalendar(), mode: "books" }),
    );

    expect(monthStat(books.monthBooks)).toHaveTextContent(/^2$/);
    expect(queryClient.isFetching()).toBe(0);
    expect(activityRequests()).toHaveLength(0);
  });

  it("marks the observed books as a lower bound in a month with legacy days, still without asking the server", () => {
    const { queryClient } = renderWithProviders(
      calendarCard({ calendar: uncappedCalendar("legacy_observed_only"), mode: "books" }),
    );

    expect(monthStat(books.monthBooks)).toHaveTextContent(/^≥ 2$/);
    expect(queryClient.isFetching()).toBe(0);
    expect(activityRequests()).toHaveLength(0);
  });

  it("asks the server once for the clipped month and shows its exact book count", async () => {
    renderWithProviders(calendarCard({ mode: "books" }));

    await waitFor(() => expect(monthStat(books.monthBooks)).toHaveTextContent(/^5$/));
    expect(activityRequests()).toHaveLength(1);
    const [request] = activityRequests();
    expect(request?.searchParams.get("from")).toBe("2026-03-01");
    expect(request?.searchParams.get("to")).toBe("2026-03-31");
    expect(request?.searchParams.get("limit")).toBe("1");
  });

  it("asks only for the visible part of a month the display range cuts short", async () => {
    renderWithProviders(
      calendarCard({
        calendar: calendarFixture({ displayRange: { from: "2026-02-15", to: "2026-03-10" } }),
        mode: "books",
      }),
    );

    await waitFor(() => expect(activityRequests()).toHaveLength(1));
    const [request] = activityRequests();
    expect(request?.searchParams.get("from")).toBe("2026-03-01");
    expect(request?.searchParams.get("to")).toBe("2026-03-10");
  });

  it("shows the observed count as a lower bound while the exact count loads", async () => {
    monthBooksResponse = () => new Promise<Response>(() => undefined);
    renderWithProviders(calendarCard({ mode: "books" }));

    expect(await screen.findByText(books.monthBooksLoading)).toBeInTheDocument();
    expect(monthStat(books.monthBooks)).toHaveTextContent(/^≥ 2$/);
    expect(screen.queryByRole("button", { name: books.monthBooksRetry })).not.toBeInTheDocument();
  });

  it("keeps the observed lower bound, the active days and the pages when the exact count fails", async () => {
    monthBooksResponse = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));
    renderWithProviders(calendarCard({ mode: "books" }));

    expect(await screen.findByText(books.monthBooksError)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: books.monthBooksRetry })).toHaveAttribute(
      "aria-disabled",
      "false",
    );
    expect(monthStat(books.monthBooks)).toHaveTextContent(/^≥ 2$/);
    expect(monthStat(books.monthActiveDays)).toHaveTextContent(/^2$/);
    expect(monthStat(books.monthPages)).toHaveTextContent(/^184$/);
  });

  it("holds the focused retry button disabled while it runs, then hands focus to the month", async () => {
    let resolveRetry: (response: Response) => void = () => undefined;
    const pendingRetry = new Promise<Response>((resolve) => {
      resolveRetry = resolve;
    });
    const responses = [Promise.resolve(jsonResponse({ message: "boom" }, 500)), pendingRetry];
    monthBooksResponse = () =>
      responses.shift() ?? Promise.reject(new Error("unexpected third month request"));
    const user = userEvent.setup();
    renderWithProviders(calendarCard({ mode: "books" }));
    const retry = await screen.findByRole("button", { name: books.monthBooksRetry });

    await user.click(retry);

    await waitFor(() => expect(activityRequests()).toHaveLength(2));
    expect(retry).toHaveAttribute("aria-disabled", "true");
    expect(retry).toHaveFocus();
    expect(screen.getByText(books.monthBooksLoading)).toBeInTheDocument();

    await user.click(retry);
    resolveRetry(jsonResponse(activityPage()));

    await waitFor(() => expect(monthStat(books.monthBooks)).toHaveTextContent(/^5$/));
    const monthLabel = formatMonthKey("2026-03", "uk").replace(/\s+/g, " ");
    await waitFor(() => expect(screen.getByText(monthLabel)).toHaveFocus());
    expect(activityRequests()).toHaveLength(2);
  });

  it("falls back to the observed lower bound with a retry when a refetch of a loaded count fails", async () => {
    const responses = [
      Promise.resolve(jsonResponse(activityPage())),
      Promise.resolve(jsonResponse({ message: "boom" }, 500)),
      Promise.resolve(jsonResponse(activityPage())),
    ];
    monthBooksResponse = () =>
      responses.shift() ?? Promise.reject(new Error("unexpected fourth month request"));
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(calendarCard({ mode: "books" }));
    await waitFor(() => expect(monthStat(books.monthBooks)).toHaveTextContent(/^5$/));

    await act(() => invalidateStatisticsQueries(queryClient));

    expect(await screen.findByText(books.monthBooksError)).toBeInTheDocument();
    expect(monthStat(books.monthBooks)).toHaveTextContent(/^≥ 2$/);
    expect(monthStat(books.monthActiveDays)).toHaveTextContent(/^2$/);
    expect(monthStat(books.monthPages)).toHaveTextContent(/^184$/);
    expect(screen.getByText("+3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: books.monthBooksRetry }));

    await waitFor(() => expect(monthStat(books.monthBooks)).toHaveTextContent(/^5$/));
    expect(screen.queryByText(books.monthBooksError)).not.toBeInTheDocument();
    expect(activityRequests()).toHaveLength(3);
  });

  it("marks the exact count as a lower bound when the server only has legacy history", async () => {
    monthBooksResponse = () =>
      Promise.resolve(jsonResponse(activityPage({ historyQuality: "legacy_observed_only" })));
    renderWithProviders(calendarCard({ mode: "books" }));

    await waitFor(() => expect(monthStat(books.monthBooks)).toHaveTextContent(/^≥ 5$/));
  });

  it("never asks for the month count in activity mode", () => {
    const { queryClient } = renderWithProviders(calendarCard());

    expect(screen.getByRole("radio", { name: calendarText.modes.activity })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(queryClient.isFetching()).toBe(0);
    expect(activityRequests()).toHaveLength(0);
  });

  it("refetches the month count when the statistics family is invalidated", async () => {
    const { queryClient } = renderWithProviders(calendarCard({ mode: "books" }));
    await waitFor(() => expect(monthStat(books.monthBooks)).toHaveTextContent(/^5$/));

    await act(() => invalidateStatisticsQueries(queryClient));

    await waitFor(() => expect(activityRequests()).toHaveLength(2));
  });

  it("keeps the month count out of the reading-activity interval cache", async () => {
    const { queryClient } = renderWithProviders(calendarCard({ mode: "books" }));
    await waitFor(() => expect(monthStat(books.monthBooks)).toHaveTextContent(/^5$/));

    expect(
      queryClient
        .getQueryCache()
        .findAll({ queryKey: getStatisticsControllerGetReadingActivityQueryKey() }),
    ).toHaveLength(0);
  });
});

describe("ReadingCalendarCard stale month", () => {
  it.each([["1999-01"], ["2026-13"]])(
    "drops the month %s once, even across a rerender with the same props",
    (month) => {
      const { rerender } = renderWithProviders(calendarCard({ mode: "books", month }));

      expect(onMonthChange).toHaveBeenCalledTimes(1);
      expect(onMonthChange).toHaveBeenCalledWith(null);

      rerender(calendarCard({ mode: "books", month }));

      expect(onMonthChange).toHaveBeenCalledTimes(1);
    },
  );

  it.each([["2026-03"], [null]] as const)("leaves the month %s alone", (month) => {
    renderWithProviders(calendarCard({ mode: "books", month }));

    expect(onMonthChange).not.toHaveBeenCalled();
  });
});
