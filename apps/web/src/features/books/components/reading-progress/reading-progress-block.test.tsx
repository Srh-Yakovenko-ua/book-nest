import "@testing-library/jest-dom/vitest";

import type { BookView, ReadingHistorySummaryView } from "@app/shared";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makeBookView } from "../book-details.fixtures";
import {
  makeReadingDay,
  makeReadingHistoryView,
  makeReadingSummary,
} from "../reading-history.fixtures";
import { ReadingProgressBlock } from "./reading-progress-block";

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
  const calls = historyRequests();
  const last = calls.at(-1);
  if (last === undefined) throw new Error("no reading-history request captured");
  return new URL(String(last[0]), "http://localhost").searchParams;
}

function renderBlock(book: BookView, onViewFullHistory = vi.fn()) {
  return renderWithProviders(
    <ReadingProgressBlock book={book} onViewFullHistory={onViewFullHistory} />,
  );
}

function respondWith(view: unknown, status = 200) {
  fetchMock.mockImplementation((input) => {
    if (String(input).includes("/reading-history")) {
      return Promise.resolve(jsonResponse(view, status));
    }
    return Promise.reject(new Error(`unexpected fetch: ${String(input)}`));
  });
}

const readingBook = makeBookView({
  readingProgress: {
    abandonedAt: null,
    currentPage: 250,
    finishedAt: null,
    impression: null,
    lastProgressUpdateAt: "2026-03-12",
    note: null,
    pausedAt: null,
    rating: null,
    startedAt: "2026-03-01",
  },
  readingStatus: "reading",
});

function readingSummary(overrides: Partial<ReadingHistorySummaryView> = {}) {
  return makeReadingSummary({ status: "reading", ...overrides });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ReadingProgressBlock", () => {
  it("renders the reading-progress title with the progress bar for a reading book", async () => {
    respondWith(makeReadingHistoryView({ summary: readingSummary() }));

    renderBlock(readingBook);

    expect(await screen.findByText("250 із 320 сторінок")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Прогрес читання" })).toBeInTheDocument();
    expect(screen.getByText("78%")).toBeInTheDocument();
  });

  it("exposes the progress percent through the progressbar role", async () => {
    respondWith(makeReadingHistoryView({ summary: readingSummary({ progressPercent: 78 }) }));

    renderBlock(readingBook);

    const bar = await screen.findByRole("progressbar", { name: "Прогрес читання" });
    expect(bar).toHaveAttribute("aria-valuenow", "78");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("shows the summary title for a finished book", async () => {
    const finishedBook = makeBookView({ readingStatus: "finished" });
    respondWith(
      makeReadingHistoryView({
        summary: makeReadingSummary({ finishedAt: "2026-02-10", status: "finished" }),
      }),
    );

    renderBlock(finishedBook);

    expect(await screen.findByRole("heading", { name: "Підсумок читання" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Прогрес читання" })).not.toBeInTheDocument();
  });

  it("renders a page-only label without a progress bar when the page count is unknown", async () => {
    respondWith(
      makeReadingHistoryView({
        summary: readingSummary({ pagesCount: null, progressPercent: null }),
      }),
    );

    renderBlock(readingBook);

    expect(await screen.findByText("Сторінка 250")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("hides the percent and bar when the backend omits the progress percent", async () => {
    respondWith(makeReadingHistoryView({ summary: readingSummary({ progressPercent: null }) }));

    renderBlock(readingBook);

    expect(await screen.findByText("250 із 320 сторінок")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText("78%")).not.toBeInTheDocument();
  });

  it("shows the remaining pages for a reading book", async () => {
    respondWith(makeReadingHistoryView({ summary: readingSummary({ pagesRemaining: 70 }) }));

    renderBlock(readingBook);

    expect(await screen.findByText("Залишилося")).toBeInTheDocument();
    expect(screen.getByText("70 сторінок")).toBeInTheDocument();
  });

  it("hides the remaining pages for a finished book", async () => {
    const finishedBook = makeBookView({ readingStatus: "finished" });
    respondWith(
      makeReadingHistoryView({
        summary: makeReadingSummary({
          finishedAt: "2026-02-10",
          pagesRemaining: 0,
          status: "finished",
        }),
      }),
    );

    renderBlock(finishedBook);

    await screen.findByText("Завершено");
    expect(screen.queryByText("Залишилося")).not.toBeInTheDocument();
  });

  it("shows the reading duration from the response for a finished book", async () => {
    const finishedBook = makeBookView({ readingStatus: "finished" });
    respondWith(
      makeReadingHistoryView({
        summary: makeReadingSummary({
          finishedAt: "2026-02-10",
          readingPeriod: { calendarDays: 12, endDate: "2026-02-10", startDate: "2026-01-29" },
          status: "finished",
        }),
      }),
    );

    renderBlock(finishedBook);

    expect(await screen.findByText("Тривалість")).toBeInTheDocument();
    expect(screen.getByText("12 днів")).toBeInTheDocument();
  });

  it("renders the paused date and stop page for a paused book", async () => {
    const pausedBook = makeBookView({ readingStatus: "paused" });
    respondWith(
      makeReadingHistoryView({
        summary: makeReadingSummary({
          estimatedActiveDaysRemaining: 5,
          pausedAt: "2026-03-05",
          status: "paused",
        }),
      }),
    );

    renderBlock(pausedBook);

    expect(await screen.findByText("На паузі з")).toBeInTheDocument();
    expect(screen.getByText("Зупинка")).toBeInTheDocument();
  });

  it("renders an abandoned book with neutral, non-error semantics", async () => {
    const dnfBook = makeBookView({ readingStatus: "dnf" });
    respondWith(
      makeReadingHistoryView({
        summary: makeReadingSummary({ abandonedAt: "2026-03-04", status: "dnf" }),
      }),
    );

    renderBlock(dnfBook);

    expect(await screen.findByText("Припинено")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the active-days statistic", async () => {
    respondWith(makeReadingHistoryView({ summary: readingSummary({ activeDaysCount: 6 }) }));

    renderBlock(readingBook);

    expect(await screen.findByText("6 активних днів")).toBeInTheDocument();
  });

  it("omits the average metric when the backend returns null", async () => {
    respondWith(
      makeReadingHistoryView({
        activity: {
          summary: {
            activeDaysCount: 3,
            averagePagesPerActiveDay: null,
            bestDay: null,
            pagesRead: 167,
            updatesCount: 5,
          },
        },
        summary: readingSummary({ activeDaysCount: 6, averagePagesPerActiveDay: null }),
      }),
    );

    renderBlock(readingBook);

    await screen.findByText("6 активних днів");
    expect(screen.queryByText(/стор\.\/активний день/)).not.toBeInTheDocument();
  });

  it("omits the best-day metric when the backend returns null", async () => {
    respondWith(makeReadingHistoryView({ summary: readingSummary({ bestDay: null }) }));

    renderBlock(readingBook);

    await screen.findByText("6 активних днів");
    expect(screen.queryByText(/найкращий день/)).not.toBeInTheDocument();
  });

  it("shows the forecast when the backend provides it for a reading book", async () => {
    respondWith(
      makeReadingHistoryView({ summary: readingSummary({ estimatedActiveDaysRemaining: 4 }) }),
    );

    renderBlock(readingBook);

    expect(
      await screen.findByText(/За поточного темпу залишилося приблизно 4 активні дні читання\./),
    ).toBeInTheDocument();
  });

  it("hides the forecast for a paused book even when the backend sends a value", async () => {
    const pausedBook = makeBookView({ readingStatus: "paused" });
    respondWith(
      makeReadingHistoryView({
        summary: makeReadingSummary({
          estimatedActiveDaysRemaining: 4,
          pausedAt: "2026-03-05",
          status: "paused",
        }),
      }),
    );

    renderBlock(pausedBook);

    await screen.findByText("На паузі з");
    expect(screen.queryByText(/За поточного темпу/)).not.toBeInTheDocument();
  });

  it("hides the forecast for a finished book even when the backend sends a value", async () => {
    const finishedBook = makeBookView({ readingStatus: "finished" });
    respondWith(
      makeReadingHistoryView({
        summary: makeReadingSummary({
          estimatedActiveDaysRemaining: 4,
          finishedAt: "2026-02-10",
          status: "finished",
        }),
      }),
    );

    renderBlock(finishedBook);

    await screen.findByText("Завершено");
    expect(screen.queryByText(/За поточного темпу/)).not.toBeInTheDocument();
  });

  it("shows the incomplete-history notice when tracking is partial", async () => {
    respondWith(
      makeReadingHistoryView({
        summary: readingSummary({
          historyCompleteness: { isComplete: false, untrackedPages: 40 },
        }),
      }),
    );

    renderBlock(readingBook);

    expect(
      await screen.findByText(
        "Частина раніше збереженого прогресу не має детальної історії оновлень.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the neutral empty message and start CTA for a not-started book", async () => {
    const notStartedBook = makeBookView({ readingStatus: "not_started" });
    respondWith(
      makeReadingHistoryView({
        days: [],
        summary: makeReadingSummary({
          activeDaysCount: 0,
          bestDay: null,
          currentPage: 0,
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

    renderBlock(notStartedBook);

    expect(
      await screen.findByText("Історія прогресу з’явиться після першого оновлення сторінки."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Почати читати" })).toBeInTheDocument();
    expect(screen.queryByText("Активність читання")).not.toBeInTheDocument();
  });

  it("shows the legacy message instead of the chart when there are no tracked updates", async () => {
    respondWith(
      makeReadingHistoryView({
        days: [],
        summary: readingSummary({ activeDaysCount: 0, bestDay: null, updatesCount: 0 }),
      }),
    );

    renderBlock(readingBook);

    expect(
      await screen.findByText("Для цього прогресу ще немає детальної історії оновлень."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Активність читання")).not.toBeInTheDocument();
    expect(screen.queryByText("Остання активність")).not.toBeInTheDocument();
  });

  it("requests the default 7-day range with the compact limit on mount", async () => {
    respondWith(makeReadingHistoryView({ summary: readingSummary() }));

    renderBlock(readingBook);

    await screen.findByRole("radio", { name: "7 днів" });
    const params = lastHistoryParams();
    expect(params.get("activityRange")).toBe("7d");
    expect(params.get("limit")).toBe("3");
    expect(params.get("page")).toBe("1");
    expect(params.get("sort")).toBe("desc");
  });

  it("requests the 14-day range when the range control switches to it", async () => {
    respondWith(makeReadingHistoryView({ summary: readingSummary() }));

    renderBlock(readingBook);

    await userEvent.click(await screen.findByRole("radio", { name: "14 днів" }));

    await waitFor(() => expect(lastHistoryParams().get("activityRange")).toBe("14d"));
  });

  it("requests the full range when the range control switches to it", async () => {
    respondWith(makeReadingHistoryView({ summary: readingSummary() }));

    renderBlock(readingBook);

    await userEvent.click(await screen.findByRole("radio", { name: "Увесь період" }));

    await waitFor(() => expect(lastHistoryParams().get("activityRange")).toBe("all"));
  });

  it("renders the activity summary from the backend without recomputing it", async () => {
    respondWith(
      makeReadingHistoryView({
        activity: {
          summary: {
            activeDaysCount: 3,
            averagePagesPerActiveDay: 55.7,
            bestDay: null,
            pagesRead: 167,
            updatesCount: 5,
          },
        },
        summary: readingSummary(),
      }),
    );

    renderBlock(readingBook);

    expect(
      await screen.findByText("3 активні дні · 167 сторінок · 55,7 стор./активний день"),
    ).toBeInTheDocument();
  });

  it("renders the recent day groups returned by the backend", async () => {
    respondWith(
      makeReadingHistoryView({
        days: [
          makeReadingDay({ date: "2026-03-12", finalPage: 250, pagesRead: 35, updatesCount: 3 }),
          makeReadingDay({ date: "2026-03-11", finalPage: 215, pagesRead: 20, updatesCount: 1 }),
          makeReadingDay({ date: "2026-03-10", finalPage: 195, pagesRead: 12, updatesCount: 2 }),
        ],
        summary: readingSummary(),
      }),
    );

    renderBlock(readingBook);

    await screen.findByText("Остання активність");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("До сторінки 250")).toBeInTheDocument();
    expect(screen.getByText("До сторінки 215")).toBeInTheDocument();
    expect(screen.getByText("До сторінки 195")).toBeInTheDocument();
  });

  it("invokes the view-full-history callback from the recent-activity CTA", async () => {
    const onViewFullHistory = vi.fn();
    respondWith(makeReadingHistoryView({ summary: readingSummary() }));

    renderBlock(readingBook, onViewFullHistory);

    const cta = await screen.findByRole("button", { name: /Переглянути повну історію/ });
    await userEvent.click(cta);

    expect(onViewFullHistory).toHaveBeenCalledTimes(1);
  });

  it("shows a busy skeleton while the initial request is pending", () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));

    renderBlock(readingBook);

    expect(document.querySelector("[aria-busy]")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Прогрес читання" })).toBeInTheDocument();
  });

  it("keeps the previous data visible and marks the chart busy during a range refetch", async () => {
    let resolveSecond: ((response: Response) => void) | undefined;
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(jsonResponse(makeReadingHistoryView({ summary: readingSummary() }))),
    );
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveSecond = resolve;
        }),
    );

    renderBlock(readingBook);

    await screen.findByText("250 із 320 сторінок");
    await userEvent.click(screen.getByRole("radio", { name: "14 днів" }));

    await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument());
    expect(screen.getByText("250 із 320 сторінок")).toBeInTheDocument();

    resolveSecond?.(jsonResponse(makeReadingHistoryView({ summary: readingSummary() })));
  });

  it("shows an error card and recovers when retry succeeds", async () => {
    fetchMock.mockImplementationOnce(() => Promise.resolve(jsonResponse({ message: "boom" }, 500)));
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(makeReadingHistoryView({ summary: readingSummary() }))),
    );

    renderBlock(readingBook);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Не вдалося завантажити історію читання.");

    await userEvent.click(screen.getByRole("button", { name: "Спробувати ще раз" }));

    expect(await screen.findByText("250 із 320 сторінок")).toBeInTheDocument();
  });

  it("renders the singular Ukrainian plural form for a single active day", async () => {
    respondWith(makeReadingHistoryView({ summary: readingSummary({ activeDaysCount: 1 }) }));

    renderBlock(readingBook);

    expect(await screen.findByText("1 активний день")).toBeInTheDocument();
  });
});
