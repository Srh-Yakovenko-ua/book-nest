import "@testing-library/jest-dom/vitest";

import type { BookView } from "@app/shared";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { makeBookView } from "../book-details.fixtures";
import {
  makeReadingDay,
  makeReadingHistoryView,
  makeReadingSummary,
} from "../reading-history.fixtures";
import { ReadingHistoryEmptyState } from "./reading-history-empty-state";
import { ReadingHistoryTab } from "./reading-history-tab";

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function historyRequests() {
  return fetchMock.mock.calls.filter(([input]) => String(input).includes("/reading-history"));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function lastHistoryParams(): URLSearchParams {
  const last = historyRequests().at(-1);
  if (last === undefined) throw new Error("no reading-history request captured");
  return new URL(String(last[0]), "http://localhost").searchParams;
}

function paginatedView(params: URLSearchParams, totalPages: number) {
  const page = Number(params.get("page") ?? "1");
  return makeReadingHistoryView({
    days: [makeReadingDay({ date: "2026-03-12" })],
    pagination: {
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      limit: 20,
      page,
      totalDays: totalPages * 20,
      totalPages,
    },
    summary: makeReadingSummary(),
  });
}

function respondByParams(build: (params: URLSearchParams) => unknown) {
  fetchMock.mockImplementation((input) => {
    if (String(input).includes("/reading-history")) {
      const params = new URL(String(input), "http://localhost").searchParams;
      return Promise.resolve(jsonResponse(build(params)));
    }
    return Promise.reject(new Error(`unexpected fetch: ${String(input)}`));
  });
}

function respondWith(view: unknown, status = 200) {
  fetchMock.mockImplementation((input) => {
    if (String(input).includes("/reading-history")) {
      return Promise.resolve(jsonResponse(view, status));
    }
    return Promise.reject(new Error(`unexpected fetch: ${String(input)}`));
  });
}

const book = makeBookView({ readingStatus: "reading" });

function renderTab(props: { book?: BookView; isActive?: boolean; key?: string } = {}) {
  const { book: tabBook = book, isActive = true, key } = props;
  return renderWithProviders(<ReadingHistoryTab book={tabBook} isActive={isActive} key={key} />);
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ReadingHistoryTab", () => {
  it("renders the header and the all-updates section for an active tab", async () => {
    respondWith(makeReadingHistoryView());

    renderTab();

    expect(
      await screen.findByRole("heading", { name: "Повна історія читання" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Усі оновлення прогресу" })).toBeInTheDocument();
  });

  it("does not fetch until the tab becomes active", async () => {
    respondWith(makeReadingHistoryView());

    const { rerender } = renderTab({ isActive: false });

    expect(historyRequests()).toHaveLength(0);

    rerender(<ReadingHistoryTab book={book} isActive />);

    await waitFor(() => expect(historyRequests().length).toBeGreaterThan(0));
  });

  it("requests the default descending sort and marks newest-first as selected", async () => {
    respondWith(makeReadingHistoryView());

    renderTab();

    const newest = await screen.findByRole("radio", { name: "Спочатку нові" });
    expect(newest).toHaveAttribute("aria-checked", "true");
    expect(lastHistoryParams().get("sort")).toBe("desc");
  });

  it("renders the day accordion header from the backend day summary", async () => {
    respondWith(
      makeReadingHistoryView({
        days: [
          makeReadingDay({ date: "2026-03-12", finalPage: 250, pagesRead: 35, updatesCount: 3 }),
        ],
      }),
    );

    renderTab();

    const trigger = await screen.findByRole("button", { name: /12 бер\. 2026/ });
    expect(within(trigger).getByText("+35 сторінок")).toBeInTheDocument();
    expect(within(trigger).getByText("3 оновлення")).toBeInTheDocument();
    expect(within(trigger).getByText("До сторінки 250")).toBeInTheDocument();
  });

  it("reveals the day events only after the accordion is expanded", async () => {
    respondWith(
      makeReadingHistoryView({
        days: [
          makeReadingDay({
            events: [{ date: "2026-03-12", id: "e1", page: 225, pagesRead: 10, recordedAt: "2026-03-12T10:20:00.000Z" }],
          }),
        ],
      }),
    );

    renderTab();

    const trigger = await screen.findByRole("button", { expanded: false });
    expect(screen.queryByText("До сторінки 225")).not.toBeInTheDocument();

    await userEvent.click(trigger);

    expect(await screen.findByRole("button", { expanded: true })).toBeInTheDocument();
    expect(screen.getByText("До сторінки 225")).toBeInTheDocument();
  });

  it("toggles the accordion open with the keyboard", async () => {
    respondWith(makeReadingHistoryView({ days: [makeReadingDay()] }));

    renderTab();

    const trigger = await screen.findByRole("button", { expanded: false });
    trigger.focus();
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByRole("button", { expanded: true })).toBeInTheDocument();
  });

  it("hides pagination when the backend reports a single page", async () => {
    respondWith(makeReadingHistoryView({ pagination: { totalPages: 1 } }));

    renderTab();

    await screen.findByRole("heading", { name: "Усі оновлення прогресу" });
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("renders pagination from the backend metadata when there is more than one page", async () => {
    respondByParams((params) => paginatedView(params, 3));

    renderTab();

    expect(await screen.findByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Сторінка 2" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Сторінка 3" })).toBeInTheDocument();
  });

  it("requests the selected page when pagination changes", async () => {
    respondByParams((params) => paginatedView(params, 3));

    renderTab();

    await userEvent.click(await screen.findByRole("link", { name: "Сторінка 2" }));

    await waitFor(() => expect(lastHistoryParams().get("page")).toBe("2"));
  });

  it("resets to the first page when the sort order changes", async () => {
    respondByParams((params) => paginatedView(params, 3));

    renderTab();

    await userEvent.click(await screen.findByRole("link", { name: "Сторінка 2" }));
    await waitFor(() => expect(lastHistoryParams().get("page")).toBe("2"));

    await userEvent.click(screen.getByRole("radio", { name: "Спочатку старі" }));

    await waitFor(() => {
      const params = lastHistoryParams();
      expect(params.get("sort")).toBe("asc");
      expect(params.get("page")).toBe("1");
    });
  });

  it("shows a busy skeleton while the initial request is pending", () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));

    renderTab();

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Усі оновлення прогресу" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the overview visible and marks sections busy during a page refetch", async () => {
    let resolveSecond: ((response: Response) => void) | undefined;
    fetchMock.mockImplementationOnce((input) =>
      Promise.resolve(
        jsonResponse(paginatedView(new URL(String(input), "http://localhost").searchParams, 3)),
      ),
    );
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveSecond = resolve;
        }),
    );

    renderTab();

    await userEvent.click(await screen.findByRole("link", { name: "Сторінка 2" }));

    await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Усі оновлення прогресу" })).toBeInTheDocument();

    resolveSecond?.(jsonResponse(makeReadingHistoryView()));
  });

  it("shows an error card and retries the request", async () => {
    fetchMock.mockImplementationOnce(() => Promise.resolve(jsonResponse({ message: "boom" }, 500)));
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(makeReadingHistoryView())));

    renderTab();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Не вдалося завантажити історію читання.");

    await userEvent.click(screen.getByRole("button", { name: "Спробувати ще раз" }));

    expect(
      await screen.findByRole("heading", { name: "Усі оновлення прогресу" }),
    ).toBeInTheDocument();
  });

  it("renders the localized empty state title and subtitle", () => {
    renderWithProviders(<ReadingHistoryEmptyState />);

    expect(screen.getByText("Історія читання поки порожня")).toBeInTheDocument();
    expect(
      screen.getByText("Онови поточну сторінку — тут з’являться активність і всі зміни прогресу."),
    ).toBeInTheDocument();
  });

  it("renders the empty state without looping when the history is empty and totalPages is zero", async () => {
    respondWith(
      makeReadingHistoryView({
        days: [],
        pagination: { totalDays: 0, totalPages: 0 },
        summary: makeReadingSummary({
          activeDaysCount: 0,
          bestDay: null,
          currentPage: 0,
          finishedAt: null,
          lastProgressUpdateAt: null,
          pagesRemaining: null,
          progressPercent: null,
          readingPeriod: { calendarDays: null, endDate: null, startDate: null },
          startedAt: null,
          status: "not_started",
          updatesCount: 0,
        }),
      }),
    );

    renderTab();

    expect(await screen.findByText("Історія читання поки порожня")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Усі оновлення прогресу" }),
    ).not.toBeInTheDocument();
  });

  it("renders the legacy message without looping when totalPages is zero but progress exists", async () => {
    respondWith(
      makeReadingHistoryView({
        days: [],
        pagination: { totalDays: 0, totalPages: 0 },
        summary: makeReadingSummary({
          activeDaysCount: 0,
          averagePagesPerActiveDay: null,
          bestDay: null,
          currentPage: 120,
          startedAt: "2026-03-01",
          status: "reading",
          updatesCount: 0,
        }),
      }),
    );

    renderTab();

    expect(
      await screen.findByText("Для цього прогресу ще немає детальної історії оновлень."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Усі оновлення прогресу" }),
    ).not.toBeInTheDocument();
  });

  it("resets the page and closes accordions when the book changes", async () => {
    respondByParams((params) => paginatedView(params, 3));

    const otherBook = makeBookView({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", readingStatus: "reading" });
    const { rerender } = renderWithProviders(
      <ReadingHistoryTab book={book} isActive key={book.id} />,
    );

    await userEvent.click(await screen.findByRole("link", { name: "Сторінка 2" }));
    await waitFor(() => expect(lastHistoryParams().get("page")).toBe("2"));
    await userEvent.click(screen.getByRole("button", { expanded: false }));
    await screen.findByRole("button", { expanded: true });

    rerender(<ReadingHistoryTab book={otherBook} isActive key={otherBook.id} />);

    await waitFor(() => {
      const last = historyRequests().at(-1);
      const url = new URL(String(last?.[0]), "http://localhost");
      expect(url.pathname).toContain(otherBook.id);
      expect(url.searchParams.get("page")).toBe("1");
    });
    expect(screen.queryByRole("button", { expanded: true })).not.toBeInTheDocument();
  });

  it("clamps to a valid page when the total shrinks after a data change", async () => {
    respondByParams((params) => {
      const page = Number(params.get("page") ?? "1");
      return paginatedView(params, page >= 3 ? 1 : 3);
    });

    renderTab();

    await userEvent.click(await screen.findByRole("link", { name: "Сторінка 3" }));

    await waitFor(() => expect(lastHistoryParams().get("page")).toBe("1"));
    expect(historyRequests().length).toBeLessThan(8);
  });
});
