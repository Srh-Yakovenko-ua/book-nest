import type { ReadingDayDetails, ReadingStatisticsCalendarPage } from "@app/shared";

import { defaultUserProfileSettings } from "@app/shared";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { fireEvent, renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import {
  calendarDayFixture,
  calendarFixture,
  overviewFixture,
  statisticsIds,
} from "../../model/statistics.fixtures";
import { ReadingCalendarPage } from "./reading-calendar-page";

const text = messages.statistics;

const pageText = messages.readingCalendar;

const CLOCK = {
  currentYear: 2026,
  now: new Date("2026-03-20T12:00:00Z"),
  today: "2026-03-20",
} as const;

const MONTH_LABELS = {
  december2025: "грудень 2025 р.",
  february2025: "лютий 2025 р.",
  january2025: "січень 2025 р.",
  march2026: "березень 2026 р.",
  november2025: "листопад 2025 р.",
} as const;

const JUMP_DAYS = {
  february10: { label: "10 лютого 2025 р.: 40 сторінок, 1 книга", title: "10 лютого 2025 р." },
  february12: { label: "12 лютого 2025 р.: 20 сторінок, 0 книг", title: "12 лютого 2025 р." },
} as const;

const JUMP_HIGHLIGHT_WAIT = { removalTimeoutMs: 3000, testTimeoutMs: 10_000 } as const;

const READING_DAYS_PATH = "/api/statistics/reading-days/";

let calendarResponse: (year: number) => Response = (year) => jsonResponse(calendarPage(year));

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = new URL(String(input), "http://localhost");
  if (url.pathname.endsWith("/api/statistics/calendar")) {
    return Promise.resolve(calendarResponse(Number(url.searchParams.get("year"))));
  }
  if (url.pathname.endsWith("/api/profile/settings")) {
    return Promise.resolve(jsonResponse(defaultUserProfileSettings));
  }
  if (url.pathname.includes(READING_DAYS_PATH)) {
    return Promise.resolve(jsonResponse(readingDayDetails(url.pathname.split("/").at(-1) ?? "")));
  }
  return Promise.reject(new Error(`unexpected fetch ${url.href}`));
});

const scrollIntoView = vi.fn<(options?: boolean | ScrollIntoViewOptions) => void>();

beforeEach(() => {
  vi.useFakeTimers({ now: CLOCK.now, toFake: ["Date"] });
  calendarResponse = (year) => jsonResponse(calendarPage(year));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function calendarPage(year: number): ReadingStatisticsCalendarPage {
  const range = {
    from: `${year}-01-01`,
    to: year === CLOCK.currentYear ? CLOCK.today : `${year}-12-31`,
  };
  return {
    availableYears: [2024, 2025, 2026],
    calendar: calendarFixture({
      days: [readingDay(`${year}-01-15`), readingDay(`${year}-02-10`)],
      displayRange: range,
      metricRange: range,
    }),
    meta: overviewFixture().meta,
    today: CLOCK.today,
    year,
  };
}

function calendarRequestYears(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname.endsWith("/api/statistics/calendar"))
    .map((url) => url.searchParams.get("year") ?? "");
}

function dayButtons(label: string) {
  const [heatmap, booksCalendar] = screen.getAllByRole("button", { name: label });
  return { booksCalendar, heatmap };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

async function jumpToBooksCalendar(
  user: ReturnType<typeof userEvent.setup>,
  day: { label: string; title: string },
) {
  const { heatmap } = dayButtons(day.label);
  if (heatmap === undefined) throw new Error(`no heatmap cell named ${day.label}`);
  await user.click(heatmap);
  const overlay = await screen.findByRole("dialog", { name: day.title });
  await user.click(
    await within(overlay).findByRole("button", { name: text.details.day.showInBooksCalendar }),
  );
  return overlay;
}

function lastUrlUpdate(onUrlUpdate: ReturnType<typeof renderCalendar>["onUrlUpdate"]) {
  return onUrlUpdate.mock.calls.at(-1)?.[0];
}

function readingDay(date: string) {
  return calendarDayFixture({
    booksCount: 1,
    booksPreview: [
      {
        bookId: statisticsIds.bookId,
        coverThumbUrl: null,
        pagesRead: 40,
        title: "Чарівник Земномор'я",
      },
    ],
    date,
    drilldown: { date, kind: "reading_day" },
    intensity: 2,
    pagesRead: 40,
  });
}

function readingDayDetails(date: string): ReadingDayDetails {
  return {
    books: [
      {
        bookId: statisticsIds.bookId,
        bookState: "active",
        coverThumbUrl: null,
        pagesRead: 40,
        title: "Чарівник Земномор'я",
      },
    ],
    booksCount: 1,
    date,
    historyQuality: "exact",
    pagesRead: 40,
  };
}

function readingDayRequestDates(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost").pathname)
    .filter((pathname) => pathname.includes(READING_DAYS_PATH))
    .map((pathname) => pathname.split("/").at(-1) ?? "");
}

function renderCalendar(searchParams = "", { resetUrlUpdateQueueOnMount = true } = {}) {
  const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
  renderWithProviders(
    <NuqsTestingAdapter
      hasMemory
      onUrlUpdate={onUrlUpdate}
      resetUrlUpdateQueueOnMount={resetUrlUpdateQueueOnMount}
      searchParams={searchParams}
    >
      <ReadingCalendarPage />
    </NuqsTestingAdapter>,
  );
  return { onUrlUpdate };
}

describe("ReadingCalendarPage", () => {
  it("shows the activity and the books calendars together, with no mode switch", async () => {
    renderCalendar();

    expect(await screen.findByText(pageText.activity.title)).toBeInTheDocument();
    expect(screen.getByText(pageText.books.title)).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it.each([
    ["", "2026", MONTH_LABELS.march2026],
    ["?year=2025", "2025", MONTH_LABELS.december2025],
  ])("for %j requests year %s and opens the books calendar on %s", async (search, year, month) => {
    renderCalendar(search);

    expect(await screen.findByText(month)).toBeInTheDocument();
    expect(calendarRequestYears()).toEqual([year]);
  });

  it("writes the year picked in the year picker and drops the month, with a push", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderCalendar("?year=2025&month=2025-11");
    await screen.findByText(MONTH_LABELS.november2025);

    await user.click(screen.getByRole("button", { name: text.period.yearLabel }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "2024" }),
    );

    await waitFor(() => expect(lastUrlUpdate(onUrlUpdate)?.searchParams.get("year")).toBe("2024"));
    const update = lastUrlUpdate(onUrlUpdate);
    expect(update?.searchParams.has("month")).toBe(false);
    expect(update?.options.history).toBe("push");
  });

  it("steps the books calendar back a month with a push, keeping the year and the loaded calendar", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderCalendar("?year=2025");
    await screen.findByText(MONTH_LABELS.december2025);

    await user.click(screen.getByRole("button", { name: text.calendar.books.previousMonth }));

    expect(await screen.findByText(MONTH_LABELS.november2025)).toBeInTheDocument();
    await waitFor(() =>
      expect(lastUrlUpdate(onUrlUpdate)?.searchParams.get("month")).toBe("2025-11"),
    );
    const update = lastUrlUpdate(onUrlUpdate);
    expect(update?.searchParams.get("year")).toBe("2025");
    expect(update?.options.history).toBe("push");
    expect(calendarRequestYears()).toEqual(["2025"]);
  });

  it.each([
    ["?year=abc&month=2025-13", ""],
    ["?year=2025&month=2026-03", "year=2025"],
  ])("cleans the invalid params of %s down to %j with a replace", async (search, cleaned) => {
    const { onUrlUpdate } = renderCalendar(search, { resetUrlUpdateQueueOnMount: false });

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    const update = lastUrlUpdate(onUrlUpdate);
    expect(update?.searchParams.toString()).toBe(cleaned);
    expect(update?.options.history).toBe("replace");
  });

  it("shows the unavailable state in place of both calendars", async () => {
    calendarResponse = (year) => {
      const page = calendarPage(year);
      return jsonResponse({
        ...page,
        calendar: {
          ...page.calendar,
          availability: "unavailable",
          days: [],
          reason: "NO_ACTIVITY_HISTORY",
        },
      });
    };
    renderCalendar();

    expect(await screen.findAllByText(text.calendar.unavailable)).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: text.calendar.books.previousMonth }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["legacy_lower_bound", 1],
    ["exact", 0],
  ] as const)(
    "for a year of %s history shows the lower-bound note %s times",
    async (selectedPeriodQuality, count) => {
      calendarResponse = (year) => {
        const page = calendarPage(year);
        return jsonResponse({
          ...page,
          meta: {
            ...page.meta,
            activityHistory: { reliableFrom: "2026-02-01", selectedPeriodQuality },
          },
        });
      };
      renderCalendar();

      await screen.findByText(pageText.activity.title);
      expect(screen.queryAllByText(text.states.lowerBound)).toHaveLength(count);
    },
  );

  it("shows the statistics error on a failed first load and recovers on retry", async () => {
    const user = userEvent.setup();
    calendarResponse = () => jsonResponse({ message: "boom" }, 500);
    renderCalendar();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(text.states.error.title);

    calendarResponse = (year) => jsonResponse(calendarPage(year));
    await user.click(within(alert).getByRole("button", { name: text.states.error.retry }));

    expect(await screen.findByText(pageText.activity.title)).toBeInTheDocument();
    expect(calendarRequestYears()).toEqual(["2026", "2026"]);
  });

  it.each([
    text.calendar.books.monthActiveDays,
    text.calendar.books.monthBooks,
    text.calendar.books.monthPages,
  ])("shows the month figure %j as a plain card, not a button", async (label) => {
    renderCalendar("?year=2025&month=2025-02");

    expect(await screen.findByText(label)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: (name) => name.includes(label) }),
    ).not.toBeInTheDocument();
  });

  it("shows one books month label with one pair of month arrows", async () => {
    renderCalendar("?year=2025&month=2025-02");

    expect(await screen.findAllByText(MONTH_LABELS.february2025)).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: text.calendar.books.previousMonth })).toHaveLength(
      1,
    );
    expect(screen.getAllByRole("button", { name: text.calendar.books.nextMonth })).toHaveLength(1);
  });
});

describe("ReadingCalendarPage jump from the heatmap to the books calendar", () => {
  const nativeScrollIntoView = Element.prototype.scrollIntoView;

  beforeEach(() => {
    vi.stubGlobal("innerWidth", 1280);
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  afterEach(() => {
    Element.prototype.scrollIntoView = nativeScrollIntoView;
  });

  it("from another month pushes that month, then focuses and highlights the day without reopening it", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderCalendar("?year=2025");
    await screen.findByText(MONTH_LABELS.december2025);

    await jumpToBooksCalendar(user, JUMP_DAYS.february10);

    await waitFor(() => expect(dayButtons(JUMP_DAYS.february10.label).booksCalendar).toHaveFocus());
    const { booksCalendar } = dayButtons(JUMP_DAYS.february10.label);
    expect(booksCalendar).toHaveAttribute("data-jump-highlight");
    expect(scrollIntoView).toHaveBeenLastCalledWith(expect.objectContaining({ block: "center" }));
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(booksCalendar);
    expect(screen.getByText(MONTH_LABELS.february2025)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(lastUrlUpdate(onUrlUpdate)?.searchParams.get("month")).toBe("2025-02"),
    );
    expect(lastUrlUpdate(onUrlUpdate)?.options.history).toBe("push");
    expect(calendarRequestYears()).toEqual(["2025"]);
    expect(readingDayRequestDates()).toEqual(["2025-02-10"]);
  });

  it(
    "drops the day highlight after a moment and keeps the focus on the day",
    async () => {
      const user = userEvent.setup();
      renderCalendar("?year=2025");
      await screen.findByText(MONTH_LABELS.december2025);

      await jumpToBooksCalendar(user, JUMP_DAYS.february10);
      await waitFor(() =>
        expect(dayButtons(JUMP_DAYS.february10.label).booksCalendar).toHaveAttribute(
          "data-jump-highlight",
        ),
      );
      const { booksCalendar } = dayButtons(JUMP_DAYS.february10.label);

      await waitFor(() => expect(booksCalendar).not.toHaveAttribute("data-jump-highlight"), {
        timeout: JUMP_HIGHLIGHT_WAIT.removalTimeoutMs,
      });
      expect(booksCalendar).toHaveFocus();
    },
    JUMP_HIGHLIGHT_WAIT.testTimeoutMs,
  );

  it("in the month already shown moves focus to the day on every jump and leaves the URL alone", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderCalendar("?year=2025&month=2025-02");
    await screen.findByText(MONTH_LABELS.february2025);
    const updatesBefore = onUrlUpdate.mock.calls.length;
    const { booksCalendar } = dayButtons(JUMP_DAYS.february10.label);

    await jumpToBooksCalendar(user, JUMP_DAYS.february10);
    await waitFor(() => expect(booksCalendar).toHaveFocus());
    await user.tab();
    expect(booksCalendar).not.toHaveFocus();
    await jumpToBooksCalendar(user, JUMP_DAYS.february10);

    await waitFor(() => expect(booksCalendar).toHaveFocus());
    expect(onUrlUpdate).toHaveBeenCalledTimes(updatesBefore);
  });

  it("focuses the books section when the day has pages but no book to open", async () => {
    calendarResponse = (year) => {
      const page = calendarPage(year);
      return jsonResponse({
        ...page,
        calendar: {
          ...page.calendar,
          days: [
            ...page.calendar.days,
            calendarDayFixture({
              booksCount: 0,
              date: "2025-02-12",
              drilldown: { date: "2025-02-12", kind: "reading_day" },
              intensity: 1,
              pagesRead: 20,
            }),
          ],
        },
      });
    };
    const user = userEvent.setup();
    renderCalendar("?year=2025");
    await screen.findByText(MONTH_LABELS.december2025);

    await jumpToBooksCalendar(user, JUMP_DAYS.february12);

    const booksSection = screen.getByRole("region", { name: pageText.books.title });
    await waitFor(() => expect(booksSection).toHaveFocus());
    expect(scrollIntoView).toHaveBeenLastCalledWith(expect.objectContaining({ block: "start" }));
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(booksSection);
  });

  it("drops the jump on a manual month change, so coming back neither highlights nor focuses the day", async () => {
    const user = userEvent.setup();
    renderCalendar("?year=2025");
    await screen.findByText(MONTH_LABELS.december2025);
    await jumpToBooksCalendar(user, JUMP_DAYS.february10);
    await waitFor(() =>
      expect(dayButtons(JUMP_DAYS.february10.label).booksCalendar).toHaveAttribute(
        "data-jump-highlight",
      ),
    );
    const highlightedDay = dayButtons(JUMP_DAYS.february10.label).booksCalendar;

    await user.click(screen.getByRole("button", { name: text.calendar.books.previousMonth }));
    await screen.findByText(MONTH_LABELS.january2025);
    expect(highlightedDay).not.toHaveAttribute("data-jump-highlight");
    await user.click(screen.getByRole("button", { name: text.calendar.books.nextMonth }));
    await screen.findByText(MONTH_LABELS.february2025);

    const { booksCalendar } = dayButtons(JUMP_DAYS.february10.label);
    expect(booksCalendar).not.toHaveAttribute("data-jump-highlight");
    expect(booksCalendar).not.toHaveFocus();
    expect(screen.getByRole("button", { name: text.calendar.books.nextMonth })).toHaveFocus();
  });

  it("on mobile, once the drawer exit animation end is simulated, pushes the month once and focuses the diary row", async () => {
    vi.stubGlobal("innerWidth", 375);
    const user = userEvent.setup();
    const { onUrlUpdate } = renderCalendar("?year=2025");
    await screen.findByText(text.calendar.books.emptyMonth);

    const drawer = await jumpToBooksCalendar(user, JUMP_DAYS.february10);
    await waitFor(() => expect(drawer).toHaveAttribute("data-state", "closed"));
    expect(drawer).toHaveAttribute("data-vaul-drawer");
    fireEvent.animationEnd(drawer);

    await waitFor(() => expect(dayButtons(JUMP_DAYS.february10.label).booksCalendar).toHaveFocus());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(lastUrlUpdate(onUrlUpdate)?.searchParams.get("month")).toBe("2025-02"),
    );
    expect(onUrlUpdate).toHaveBeenCalledTimes(1);
    expect(lastUrlUpdate(onUrlUpdate)?.options.history).toBe("push");
  });
});
