import type {
  ReadingDayDetails,
  ReadingStatisticsCalendarPage,
  StatisticsCalendarDay,
} from "@app/shared";
import type { ReactNode } from "react";

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
  july2025: "липень 2025 р.",
  march2025: "березень 2025 р.",
  march2026: "березень 2026 р.",
  november2025: "листопад 2025 р.",
} as const;

const JUMP_DAYS = {
  february10: { label: "10 лютого 2025 р.: 40 сторінок, 1 книга", title: "10 лютого 2025 р." },
  february12: { label: "12 лютого 2025 р.: 20 сторінок, 0 книг", title: "12 лютого 2025 р." },
} as const;

const SELECTABLE_DAYS = {
  february5: { label: "5 лютого 2025 р.: 40 сторінок, 1 книга", title: "5 лютого 2025 р." },
  february10: JUMP_DAYS.february10,
} as const;

const JUMP_HIGHLIGHT_WAIT = { removalTimeoutMs: 3000, testTimeoutMs: 10_000 } as const;

const READING_DAYS_PATH = "/api/statistics/reading-days/";

const QUARTER_LABELS = {
  q1of2025: /^січень\s+–\s+березень 2025 р\.$/u,
  q1of2026: /^січень\s+–\s+березень 2026 р\.$/u,
  q2of2025: /^квітень\s+–\s+червень 2025 р\.$/u,
  q4of2025: /^жовтень\s+–\s+грудень 2025 р\.$/u,
} as const;

const QUARTERS_FROM_DECEMBER_TO_FEBRUARY = 3;

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

function booksCalendarDay(day: keyof typeof SELECTABLE_DAYS) {
  return within(screen.getByRole("region", { name: pageText.books.title })).getByRole("button", {
    name: SELECTABLE_DAYS[day].label,
  });
}

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
  const booksRegion = screen.getByRole("region", { name: pageText.books.title });
  const buttons = screen.getAllByRole("button", { name: label });
  return {
    booksCalendar: buttons.find((button) => booksRegion.contains(button)),
    heatmap: buttons.find((button) => !booksRegion.contains(button)),
  };
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

function quarterLabel(pattern: RegExp) {
  return screen.getByText((content) => pattern.test(content));
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

async function stepQuarterBack(user: ReturnType<typeof userEvent.setup>, times: number) {
  for (let step = 0; step < times; step += 1) {
    await user.click(screen.getByRole("button", { name: pageText.activity.previousQuarter }));
  }
}

function withMarchDay(year: number, day: Partial<StatisticsCalendarDay>): Response {
  const page = calendarPage(year);
  const date = `${year}-03-03`;
  return jsonResponse({
    ...page,
    calendar: {
      ...page.calendar,
      days: [
        ...page.calendar.days,
        calendarDayFixture({ date, drilldown: { date, kind: "reading_day" }, ...day }),
      ],
    },
  });
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
    ["?year=abc&month=2025-13", "", MONTH_LABELS.march2026],
    ["?year=2025&month=2026-03", "year=2025", MONTH_LABELS.december2025],
    ["?year=2025&month=2025-07&day=2025-07-40", "year=2025&month=2025-07", MONTH_LABELS.july2025],
  ])(
    "cleans the invalid params of %s down to %j with a replace and still shows %s",
    async (search, cleaned, month) => {
      const { onUrlUpdate } = renderCalendar(search, { resetUrlUpdateQueueOnMount: false });

      await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
      const update = lastUrlUpdate(onUrlUpdate);
      expect(update?.searchParams.toString()).toBe(cleaned);
      expect(update?.options.history).toBe("replace");
      expect(await screen.findByText(month)).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );

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

  it("shows the empty-calendar art in both calendars for a year without reading", async () => {
    calendarResponse = (year) => {
      const page = calendarPage(year);
      return jsonResponse({ ...page, calendar: { ...page.calendar, days: [] } });
    };
    renderCalendar();

    expect(await screen.findAllByText(text.calendar.empty)).toHaveLength(2);
    const sources = screen.getAllByRole("presentation").map((image) => image.getAttribute("src"));
    expect(sources.filter((src) => src?.includes("line-calendar-empty.png"))).toHaveLength(2);
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
  ])("shows the month figure %j as static text, not a button", async (label) => {
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
    await stepQuarterBack(user, QUARTERS_FROM_DECEMBER_TO_FEBRUARY);
    expect(quarterLabel(QUARTER_LABELS.q1of2025)).toBeInTheDocument();
    expect(onUrlUpdate).not.toHaveBeenCalled();

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
    expect(lastUrlUpdate(onUrlUpdate)?.searchParams.get("day")).toBe("2025-02-10");
    expect(lastUrlUpdate(onUrlUpdate)?.options.history).toBe("push");
    expect(calendarRequestYears()).toEqual(["2025"]);
    expect(new Set(readingDayRequestDates())).toEqual(new Set(["2025-02-10"]));
  });

  it(
    "drops the day highlight after a moment and keeps the focus on the day",
    async () => {
      const user = userEvent.setup();
      renderCalendar("?year=2025");
      await screen.findByText(MONTH_LABELS.december2025);
      await stepQuarterBack(user, QUARTERS_FROM_DECEMBER_TO_FEBRUARY);

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

  it("in the month already shown moves focus to the day on every jump and writes the day with a replace", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderCalendar("?year=2025&month=2025-02");
    await screen.findByText(MONTH_LABELS.february2025);
    const { booksCalendar } = dayButtons(JUMP_DAYS.february10.label);

    await jumpToBooksCalendar(user, JUMP_DAYS.february10);
    await waitFor(() => expect(booksCalendar).toHaveFocus());
    await user.tab();
    expect(booksCalendar).not.toHaveFocus();
    await jumpToBooksCalendar(user, JUMP_DAYS.february10);

    await waitFor(() => expect(booksCalendar).toHaveFocus());
    await waitFor(() =>
      expect(lastUrlUpdate(onUrlUpdate)?.searchParams.get("day")).toBe("2025-02-10"),
    );
    expect(lastUrlUpdate(onUrlUpdate)?.searchParams.get("month")).toBe("2025-02");
    expect(lastUrlUpdate(onUrlUpdate)?.options.history).toBe("replace");
    expect(onUrlUpdate.mock.calls.map(([update]) => update.options.history)).not.toContain("push");
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
    await stepQuarterBack(user, QUARTERS_FROM_DECEMBER_TO_FEBRUARY);

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
    await stepQuarterBack(user, QUARTERS_FROM_DECEMBER_TO_FEBRUARY);
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
    await stepQuarterBack(user, QUARTERS_FROM_DECEMBER_TO_FEBRUARY);

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

describe("ReadingCalendarPage books month with two reading days", () => {
  beforeEach(() => {
    vi.stubGlobal("innerWidth", 1280);
    calendarResponse = (year) => {
      const page = calendarPage(year);
      return jsonResponse({
        ...page,
        calendar: {
          ...page.calendar,
          days: [
            readingDay(`${year}-01-15`),
            readingDay(`${year}-02-05`),
            readingDay(`${year}-02-10`),
          ],
        },
      });
    };
  });

  it("presses the day named in the URL and titles the day panel with its date", async () => {
    renderCalendar("?year=2025&month=2025-02&day=2025-02-05");
    await screen.findByText(MONTH_LABELS.february2025);

    expect(booksCalendarDay("february5")).toHaveAttribute("aria-pressed", "true");
    expect(booksCalendarDay("february10")).toHaveAttribute("aria-pressed", "false");
    const panel = screen.getByRole("region", { name: SELECTABLE_DAYS.february5.title });
    expect(within(panel).getByRole("heading", { level: 3 })).toHaveTextContent(
      SELECTABLE_DAYS.february5.title,
    );
  });

  it("presses the latest day with books when the URL names no day", async () => {
    renderCalendar("?year=2025&month=2025-02");
    await screen.findByText(MONTH_LABELS.february2025);

    expect(booksCalendarDay("february10")).toHaveAttribute("aria-pressed", "true");
    expect(booksCalendarDay("february5")).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("region", { name: SELECTABLE_DAYS.february10.title }),
    ).toBeInTheDocument();
  });

  it("selects another day with books in place, writing it with a replace and opening no dialog", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderCalendar("?year=2025&month=2025-02");
    await screen.findByText(MONTH_LABELS.february2025);

    await user.click(booksCalendarDay("february5"));

    await waitFor(() =>
      expect(booksCalendarDay("february5")).toHaveAttribute("aria-pressed", "true"),
    );
    expect(booksCalendarDay("february10")).toHaveAttribute("aria-pressed", "false");
    expect(
      await screen.findByRole("region", { name: SELECTABLE_DAYS.february5.title }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(lastUrlUpdate(onUrlUpdate)?.searchParams.get("day")).toBe("2025-02-05"),
    );
    expect(lastUrlUpdate(onUrlUpdate)?.searchParams.get("month")).toBe("2025-02");
    expect(lastUrlUpdate(onUrlUpdate)?.options.history).toBe("replace");
  });

  it("lists the month figures as label and value pairs: reading days, books, pages", async () => {
    vi.stubGlobal("innerWidth", 375);
    renderCalendar("?year=2025&month=2025-02");

    const terms = await screen.findAllByRole("term");

    expect(terms.map((term) => term.textContent)).toEqual([
      text.calendar.books.monthActiveDays,
      text.calendar.books.monthBooks,
      text.calendar.books.monthPages,
    ]);
    expect(screen.getAllByRole("definition").map((value) => value.textContent)).toEqual([
      "2",
      "1",
      "80",
    ]);
  });
});

describe("ReadingCalendarPage books month history note on desktop", () => {
  beforeEach(() => {
    vi.stubGlobal("innerWidth", 1280);
  });

  it("leaves out the unknown-history note in a fully recorded month", async () => {
    renderCalendar("?year=2025&month=2025-02");
    await screen.findByText(MONTH_LABELS.february2025);

    const booksRegion = screen.getByRole("region", { name: pageText.books.title });
    expect(
      within(booksRegion).queryByText(text.calendar.heatmap.unknownLegend),
    ).not.toBeInTheDocument();
  });

  it("explains the unknown days in a month that has them", async () => {
    calendarResponse = (year) => {
      const page = calendarPage(year);
      const unknownDate = `${year}-02-03`;
      return jsonResponse({
        ...page,
        calendar: {
          ...page.calendar,
          days: [
            readingDay(`${year}-01-15`),
            calendarDayFixture({
              date: unknownDate,
              drilldown: { date: unknownDate, kind: "reading_day" },
              historyQuality: "legacy_observed_only",
            }),
            readingDay(`${year}-02-10`),
          ],
        },
      });
    };
    renderCalendar("?year=2025&month=2025-02");
    await screen.findByText(MONTH_LABELS.february2025);

    const booksRegion = screen.getByRole("region", { name: pageText.books.title });
    expect(within(booksRegion).getByText(text.calendar.heatmap.unknownLegend)).toBeInTheDocument();
  });
});

describe("ReadingCalendarPage reading intensity quarter", () => {
  beforeEach(() => {
    vi.stubGlobal("innerWidth", 1280);
  });

  it("opens on the quarter of the books month", async () => {
    renderCalendar("?year=2025");
    await screen.findByText(MONTH_LABELS.december2025);

    expect(quarterLabel(QUARTER_LABELS.q4of2025)).toBeInTheDocument();
  });

  it("steps the quarter alone, writing nothing to the URL and keeping the books month and day", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderCalendar("?year=2025&month=2025-02&day=2025-02-10");
    await screen.findByText(MONTH_LABELS.february2025);

    await user.click(screen.getByRole("button", { name: pageText.activity.nextQuarter }));

    expect(quarterLabel(QUARTER_LABELS.q2of2025)).toBeInTheDocument();
    expect(screen.getByText(MONTH_LABELS.february2025)).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: SELECTABLE_DAYS.february10.title }),
    ).toBeInTheDocument();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it("draws only the days of the shown quarter", async () => {
    const user = userEvent.setup();
    renderCalendar("?year=2025&month=2025-02");
    await screen.findByText(MONTH_LABELS.february2025);

    expect(dayButtons(JUMP_DAYS.february10.label).heatmap).toBeDefined();

    await user.click(screen.getByRole("button", { name: pageText.activity.nextQuarter }));

    expect(dayButtons(JUMP_DAYS.february10.label).heatmap).toBeUndefined();
  });

  it("goes back to the quarter of the books month once the month changes", async () => {
    const user = userEvent.setup();
    renderCalendar("?year=2025&month=2025-02");
    await screen.findByText(MONTH_LABELS.february2025);
    await user.click(screen.getByRole("button", { name: pageText.activity.nextQuarter }));
    expect(quarterLabel(QUARTER_LABELS.q2of2025)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: text.calendar.books.previousMonth }));

    await screen.findByText(MONTH_LABELS.january2025);
    expect(quarterLabel(QUARTER_LABELS.q1of2025)).toBeInTheDocument();
  });

  it("offers no step past the first quarter or into the future of the current year", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderCalendar();
    await screen.findByText(MONTH_LABELS.march2026);

    const previous = screen.getByRole("button", { name: pageText.activity.previousQuarter });
    const next = screen.getByRole("button", { name: pageText.activity.nextQuarter });
    expect(quarterLabel(QUARTER_LABELS.q1of2026)).toBeInTheDocument();
    expect(previous).toHaveAttribute("aria-disabled", "true");
    expect(next).toHaveAttribute("aria-disabled", "true");

    await user.click(next);

    expect(quarterLabel(QUARTER_LABELS.q1of2026)).toBeInTheDocument();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });
});

describe("ReadingCalendarPage page controls", () => {
  it("offers no way to clear the year", async () => {
    renderCalendar("?year=2025");
    await screen.findByText(MONTH_LABELS.december2025);

    expect(screen.getByRole("button", { name: text.period.yearLabel })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: text.period.yearClear })).not.toBeInTheDocument();
  });

  it("links the book read on the selected day to its page", async () => {
    vi.stubGlobal("innerWidth", 1280);
    renderCalendar("?year=2025&month=2025-02");
    await screen.findByText(MONTH_LABELS.february2025);

    const panel = screen.getByRole("region", { name: SELECTABLE_DAYS.february10.title });
    expect(await within(panel).findByRole("link", { name: /Чарівник Земномор'я/ })).toHaveAttribute(
      "href",
      `/books/${statisticsIds.bookId}`,
    );
  });

  it("shows a dash with its explanation for each month figure nothing confirms", async () => {
    vi.stubGlobal("innerWidth", 375);
    calendarResponse = (year) => withMarchDay(year, { historyQuality: "legacy_observed_only" });
    renderCalendar("?year=2025&month=2025-03");
    await screen.findByText(MONTH_LABELS.march2025);

    const definitions = screen.getAllByRole("definition");
    expect(definitions).toHaveLength(3);
    expect(definitions.map((definition) => definition.textContent)).toEqual(
      Array.from({ length: 3 }, () => `—${text.calendar.books.unconfirmedValueHint}`),
    );
  });

  it("shows a plain zero for each figure of a reliably empty month", async () => {
    vi.stubGlobal("innerWidth", 375);
    calendarResponse = (year) => withMarchDay(year, { historyQuality: "exact" });
    renderCalendar("?year=2025&month=2025-03");
    await screen.findByText(MONTH_LABELS.march2025);

    expect(screen.getAllByRole("definition").map((definition) => definition.textContent)).toEqual([
      "0",
      "0",
      "0",
    ]);
  });

  it("requests no day details on a phone, where the diary replaces the day panel", async () => {
    vi.stubGlobal("innerWidth", 375);
    renderCalendar("?year=2025&month=2025-02");

    await waitFor(() =>
      expect(dayButtons(SELECTABLE_DAYS.february10.label).booksCalendar).toBeDefined(),
    );
    expect(screen.queryByRole("region", { name: SELECTABLE_DAYS.february10.title })).toBeNull();
    expect(readingDayRequestDates()).toEqual([]);
  });
});
