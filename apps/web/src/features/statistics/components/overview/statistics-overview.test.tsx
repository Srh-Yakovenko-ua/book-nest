import type {
  ReadingStatisticsActivityPage,
  ReadingStatisticsInsight,
  ReadingStatisticsOverview,
} from "@app/shared";
import type { MouseEventHandler, ReactNode } from "react";

import { defaultUserProfileSettings } from "@app/shared";
import { eachDayOfInterval, format, parseISO } from "date-fns";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import type { DynamicsMetric } from "../../model/statistics-dynamics";

import { formatDayRange, formatMonthKey } from "../../model/statistics-format";
import {
  calendarDayFixture,
  completedReadFixture,
  overviewFixture,
  statisticsIds,
} from "../../model/statistics.fixtures";
import { StatisticsOverview } from "./statistics-overview";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    onClick,
  }: {
    children: ReactNode;
    href: string;
    onClick?: MouseEventHandler<HTMLAnchorElement>;
  }) => (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  ),
  usePathname: () => "/statistics",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

const text = messages.statistics;

const SECTION_TITLES = {
  activity: [
    text.dynamics.title,
    text.habits.title,
    text.habits.weekdays.title,
    text.calendar.title,
  ],
  overview: [text.kpi.completedReads.label, text.dynamics.title, text.recentReads.title],
  progress: [text.goal.title, text.series.title, text.libraryBalance.title, text.records.title],
  tastes: [
    text.ratings.title,
    text.genres.title,
    text.authors.title,
    text.publishers.title,
    text.languages.title,
    text.discoveries.title,
  ],
} as const;

const MONTH_BOOKS_PAGE: ReadingStatisticsActivityPage = {
  activeDays: 2,
  booksCount: 5,
  historyQuality: "exact",
  items: [],
  nextCursor: null,
  pagesRead: 184,
  range: { from: "2026-03-01", to: "2026-03-31" },
  reliableFrom: "2026-01-01",
};

let overviewResponse: () => Promise<Response> | Response = () => jsonResponse(overviewFixture());

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/statistics/overview")) return Promise.resolve(overviewResponse());
  if (url.includes("/api/statistics/reading-activity")) {
    return Promise.resolve(jsonResponse(MONTH_BOOKS_PAGE));
  }
  if (url.includes("/api/profile/settings")) {
    return Promise.resolve(jsonResponse(defaultUserProfileSettings));
  }
  if (url.includes("/api/genres")) return Promise.resolve(jsonResponse([]));
  return Promise.reject(new Error(`unexpected fetch ${url}`));
});

beforeEach(() => {
  overviewResponse = () => jsonResponse(overviewFixture());
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function activePanel(): Promise<HTMLElement> {
  return screen.findByRole("tabpanel");
}

async function expectSections(titles: readonly string[]) {
  const panel = await activePanel();
  for (const title of titles) {
    expect(await within(panel).findByText(title)).toBeInTheDocument();
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function overviewRequests(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes("/api/statistics/overview"));
}

function renderStatistics(searchParams = "") {
  const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
  const { queryClient } = renderWithProviders(
    <NuqsTestingAdapter hasMemory onUrlUpdate={onUrlUpdate} searchParams={searchParams}>
      <StatisticsOverview />
    </NuqsTestingAdapter>,
  );
  return { onUrlUpdate, queryClient };
}

function withActivity({
  activeDays,
  completedReads,
  pagesRead,
}: {
  activeDays: number;
  completedReads: number;
  pagesRead: number;
}): ReadingStatisticsOverview {
  const overview = overviewFixture();
  return {
    ...overview,
    calendar: { ...overview.calendar, activeDays },
    kpis: {
      ...overview.kpis,
      completedReads: { ...overview.kpis.completedReads, value: completedReads },
      pagesRead: { ...overview.kpis.pagesRead, value: pagesRead },
    },
  };
}

describe("StatisticsOverview tabs", () => {
  it.each([
    ["", "overview"],
    ["?tab=activity", "activity"],
    ["?tab=tastes", "tastes"],
    ["?tab=progress", "progress"],
    ["?tab=unknown", "overview"],
  ] as const)("opens %s on the %s panel with all of its sections", async (search, tab) => {
    renderStatistics(search);

    expect(await screen.findByRole("tab", { name: text.tabs[tab] })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expectSections(SECTION_TITLES[tab]);
  });

  it("stacks the activity tab as dynamics beside habits, then weekday activity and the calendar, with no fifth section", async () => {
    renderStatistics("?tab=activity");
    const panel = await activePanel();

    const dynamics = await within(panel).findByText(text.dynamics.title);
    const habits = within(panel).getByText(text.habits.title);
    const weekdays = within(panel).getByText(text.habits.weekdays.title);
    const calendar = within(panel).getByText(text.calendar.title);

    expect(dynamics.compareDocumentPosition(habits) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(habits.compareDocumentPosition(weekdays) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(weekdays.compareDocumentPosition(calendar) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(panel.childElementCount).toBe(3);
  });

  it("switches tabs through the URL without touching the period or refetching the overview", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderStatistics("?period=year&year=2025&compare=previous_period");
    await screen.findByRole("tab", { name: text.tabs.overview });

    await user.click(screen.getByRole("tab", { name: text.tabs.tastes }));

    await expectSections(SECTION_TITLES.tastes);
    const update = onUrlUpdate.mock.calls.at(-1)?.[0];
    expect(update?.searchParams.get("tab")).toBe("tastes");
    expect(update?.searchParams.get("period")).toBe("year");
    expect(update?.searchParams.get("year")).toBe("2025");
    expect(update?.searchParams.get("compare")).toBe("previous_period");
    expect(update?.options.history).toBe("push");

    await user.click(screen.getByRole("tab", { name: text.tabs.progress }));
    await user.click(screen.getByRole("tab", { name: text.tabs.overview }));

    await expectSections(SECTION_TITLES.overview);
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.has("tab")).toBe(false);
    expect(overviewRequests()).toHaveLength(1);
  });

  it("moves between tabs with the arrow keys", async () => {
    const user = userEvent.setup();
    renderStatistics();
    const overviewTab = await screen.findByRole("tab", { name: text.tabs.overview });

    overviewTab.focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: text.tabs.activity })).toHaveFocus();
    await expectSections(SECTION_TITLES.activity);
  });

  it("hides discoveries on the tastes tab for all time", async () => {
    const overview = overviewFixture();
    overviewResponse = () =>
      jsonResponse({
        ...overview,
        comparison: null,
        period: { ...overview.period, from: null, kind: "all_time" },
      });
    renderStatistics("?period=all_time&tab=tastes");

    await expectSections(SECTION_TITLES.tastes.filter((title) => title !== text.discoveries.title));
    expect(within(await activePanel()).queryByText(text.discoveries.title)).toBeNull();
  });

  it("keeps every tab available when the period has no reading, and refetches on a period change", async () => {
    const user = userEvent.setup();
    overviewResponse = () =>
      jsonResponse(withActivity({ activeDays: 0, completedReads: 0, pagesRead: 0 }));
    renderStatistics();

    expect(await screen.findByText(text.states.periodEmpty.title)).toBeInTheDocument();
    expect(screen.queryByText(text.kpi.completedReads.label)).toBeNull();

    for (const tab of ["activity", "tastes", "progress"] as const) {
      await user.click(screen.getByRole("tab", { name: text.tabs[tab] }));
      await expectSections(SECTION_TITLES[tab]);
    }
    expect(overviewRequests()).toHaveLength(1);

    await user.click(screen.getByRole("tab", { name: text.tabs.overview }));
    await user.click(await screen.findByRole("button", { name: text.states.periodEmpty.action }));
    expect(screen.getByRole("combobox", { name: text.period.label })).toHaveFocus();

    await waitFor(() => expect(overviewRequests()).toHaveLength(2));
    expect(overviewRequests().at(-1)).toContain("period=all_time");
  });

  it("shows the activity tab and the full overview when pages were read but no cycle finished", async () => {
    overviewResponse = () =>
      jsonResponse(withActivity({ activeDays: 3, completedReads: 0, pagesRead: 120 }));
    renderStatistics();

    await expectSections(SECTION_TITLES.overview);
    expect(screen.queryByText(text.states.periodEmpty.title)).toBeNull();

    await userEvent.setup().click(screen.getByRole("tab", { name: text.tabs.activity }));
    await expectSections(SECTION_TITLES.activity);
  });

  it("keeps the lower-bound note above the tabs on every tab", async () => {
    const user = userEvent.setup();
    const overview = overviewFixture();
    overviewResponse = () =>
      jsonResponse({
        ...overview,
        meta: {
          ...overview.meta,
          activityHistory: {
            reliableFrom: "2026-02-01",
            selectedPeriodQuality: "legacy_lower_bound",
          },
        },
      });
    renderStatistics();

    expect(await screen.findByText(text.states.lowerBound)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: text.tabs.progress }));
    expect(screen.getByText(text.states.lowerBound)).toBeInTheDocument();
  });

  it("shows the first-load error without tabs", async () => {
    overviewResponse = () => jsonResponse({ message: "boom" }, 500);
    renderStatistics("?tab=tastes");

    expect(await screen.findByText(text.states.error.title)).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("shows the invalid-range state instead of tabs and never requests the overview", async () => {
    renderStatistics("?period=custom&from=2026-05-31&to=2026-03-01&tab=activity");

    expect(await screen.findByText(text.states.invalidRange.title)).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(overviewRequests()).toHaveLength(0);
  });
});

describe("StatisticsOverview compact overview", () => {
  it("opens the pages chart on the activity tab from the pages KPI, keeping the period", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderStatistics("?period=year&year=2025&compare=previous_period");

    await user.click(
      await screen.findByRole("link", { name: new RegExp(text.kpi.pagesRead.label) }),
    );

    expect(await screen.findByRole("tab", { name: text.tabs.activity })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("radio", { name: text.dynamics.metrics.pages })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await waitFor(() => expect(document.activeElement).toHaveTextContent(text.dynamics.title));
    const update = onUrlUpdate.mock.calls.at(-1)?.[0];
    expect(update?.searchParams.toString()).toBe(
      "period=year&year=2025&compare=previous_period&metric=pages&section=dynamics&tab=activity",
    );
    expect(update?.options.history).toBe("push");
    expect(overviewRequests()).toHaveLength(1);
  });

  it("opens the habits section on the activity tab from the active-days KPI, keeping the period", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderStatistics("?period=year&year=2025&compare=previous_period");

    await user.click(
      await screen.findByRole("link", { name: new RegExp(text.kpi.activeDays.label) }),
    );

    expect(await screen.findByRole("tab", { name: text.tabs.activity })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await waitFor(() => {
      expect(document.activeElement).toHaveTextContent(text.habits.title);
      expect(document.activeElement).not.toHaveTextContent(text.calendar.title);
    });
    const update = onUrlUpdate.mock.calls.at(-1)?.[0];
    expect(update?.searchParams.toString()).toBe(
      "period=year&year=2025&compare=previous_period&section=habits&tab=activity",
    );
    expect(update?.options.history).toBe("push");
  });

  it.each([
    ["?tab=activity&section=habits", text.habits.title],
    ["?tab=activity&section=calendar", text.calendar.title],
    ["?tab=tastes&section=ratings", text.ratings.title],
  ])("moves focus to the section a deep link names (%s)", async (search, title) => {
    renderStatistics(search);

    await waitFor(() => {
      expect(document.activeElement).not.toBe(document.body);
      expect(document.activeElement).toHaveTextContent(title);
    });
  });

  it("shows only metric-relevant insights next to the chart and follows the metric toggle", async () => {
    const user = userEvent.setup();
    renderStatistics();
    await screen.findByText(text.dynamics.title);

    expect(screen.queryByText(text.insights.title)).toBeNull();

    await user.click(screen.getByRole("radio", { name: text.dynamics.metrics.pages }));

    expect(await screen.findByText(text.insights.title)).toBeInTheDocument();
    expect(screen.getByText(/Найактивніший день тижня/)).toBeInTheDocument();
  });

  it("labels the current and comparison periods of the compact chart, not of the full one", async () => {
    const user = userEvent.setup();
    const overview = overviewFixture();
    overviewResponse = () =>
      jsonResponse({
        ...overview,
        comparison: { from: "2025-01-01", mode: "same_period_last_year", to: "2025-03-31" },
        dynamics: { ...overview.dynamics, comparisonBuckets: overview.dynamics.buckets },
      });
    renderStatistics();

    expect(await screen.findByText(/^Поточний період: /)).toBeInTheDocument();
    expect(screen.getByText(/^Період порівняння: /)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: text.tabs.activity }));

    await expectSections(SECTION_TITLES.activity);
    expect(screen.queryByText(/^Поточний період: /)).toBeNull();
  });

  it("lists every recent reading cycle with its date and rating, rereads included", async () => {
    const overview = overviewFixture();
    overviewResponse = () =>
      jsonResponse({
        ...overview,
        hero: {
          ...overview.hero,
          recentCompletedReads: [
            completedReadFixture({ finishedAt: "2026-03-14", rating: 9 }),
            completedReadFixture({
              drilldown: {
                bookId: statisticsIds.bookId,
                kind: "reading_cycle",
                readingCycleId: statisticsIds.secondCycleId,
              },
              finishedAt: "2026-01-20",
              rating: null,
              readingCycleId: statisticsIds.secondCycleId,
            }),
          ],
        },
      });
    renderStatistics();

    const gallery = await screen.findByRole("region", { name: text.recentReads.title });
    const items = within(gallery).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("14 бер.");
    expect(items[0]).toHaveTextContent("9");
    expect(items[1]).toHaveTextContent("20 січ.");
  });

  describe("current goal", () => {
    beforeEach(() => {
      vi.useFakeTimers({ now: new Date("2026-03-20T12:00:00Z"), toFake: ["Date"] });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("shows the compact current goal when the period includes today", async () => {
      renderStatistics();

      expect(await screen.findByText(text.goal.currentTitle)).toBeInTheDocument();
      expect(screen.getByText("12 книг за рік")).toBeInTheDocument();
      expect(screen.queryByText(text.goal.pace)).toBeNull();
    });

    it("offers to create a goal when the current period has none", async () => {
      const overview = overviewFixture();
      overviewResponse = () =>
        jsonResponse({ ...overview, goal: { activeGoalsCount: 0, primaryGoal: null } });
      renderStatistics();

      expect(await screen.findByText(text.goal.currentTitle)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: text.goal.create })).toHaveAttribute(
        "href",
        "/goals",
      );
    });

    it("hides the goal and its call to action for a period that is over", async () => {
      const overview = overviewFixture();
      overviewResponse = () =>
        jsonResponse({
          ...overview,
          goal: { activeGoalsCount: 0, primaryGoal: null },
          period: { ...overview.period, from: "2025-01-01", to: "2025-12-31" },
        });
      renderStatistics("?period=year&year=2025");

      await screen.findByText(text.recentReads.title);
      expect(screen.queryByText(text.goal.currentTitle)).toBeNull();
      expect(screen.queryByRole("link", { name: text.goal.create })).toBeNull();
    });
  });
});

describe("StatisticsOverview calendar state in the URL", () => {
  function overviewOverThreeMonths(): ReadingStatisticsOverview {
    const overview = overviewFixture();
    return {
      ...overview,
      calendar: {
        ...overview.calendar,
        displayRange: { from: "2026-01-01", to: "2026-03-31" },
      },
    };
  }

  function lastUpdate(onUrlUpdate: ReturnType<typeof renderStatistics>["onUrlUpdate"]) {
    return onUrlUpdate.mock.calls.at(-1)?.[0];
  }

  it("switches the calendar mode in place with a replace, leaving the period, metric and section alone", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderStatistics(
      "?period=year&year=2025&compare=previous_period&metric=pages&section=calendar&tab=activity",
    );

    await user.click(await screen.findByRole("radio", { name: text.calendar.modes.books }));

    await waitFor(() =>
      expect(lastUpdate(onUrlUpdate)?.searchParams.get("calendarMode")).toBe("books"),
    );
    const update = lastUpdate(onUrlUpdate);
    expect(update?.options.history).toBe("replace");
    expect(update?.searchParams.get("period")).toBe("year");
    expect(update?.searchParams.get("year")).toBe("2025");
    expect(update?.searchParams.get("compare")).toBe("previous_period");
    expect(update?.searchParams.get("metric")).toBe("pages");
    expect(update?.searchParams.get("section")).toBe("calendar");
    expect(update?.searchParams.get("tab")).toBe("activity");
    expect(overviewRequests()).toHaveLength(1);
  });

  it("steps to the previous calendar month in place with a replace", async () => {
    const user = userEvent.setup();
    overviewResponse = () => jsonResponse(overviewOverThreeMonths());
    const { onUrlUpdate } = renderStatistics("?tab=activity&calendarMode=books");

    await user.click(
      await screen.findByRole("button", { name: text.calendar.books.previousMonth }),
    );

    await waitFor(() =>
      expect(lastUpdate(onUrlUpdate)?.searchParams.get("calendarMonth")).toBe("2026-02"),
    );
    expect(lastUpdate(onUrlUpdate)?.options.history).toBe("replace");
  });

  it("drops an out-of-range calendar month from a deep link with a replace", async () => {
    const { onUrlUpdate } = renderStatistics("?tab=activity&calendarMonth=1999-01");

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(text.calendar.title)).toBeInTheDocument();
    expect(onUrlUpdate).toHaveBeenCalledTimes(1);
    const update = onUrlUpdate.mock.calls[0]?.[0];
    expect(update?.searchParams.has("calendarMonth")).toBe(false);
    expect(update?.searchParams.get("tab")).toBe("activity");
    expect(update?.options.history).toBe("replace");
  });

  it("keeps the calendar mode and month across a tab round trip, switching tabs with a push", async () => {
    const user = userEvent.setup();
    overviewResponse = () => jsonResponse(overviewOverThreeMonths());
    const { onUrlUpdate } = renderStatistics(
      "?tab=activity&calendarMode=books&calendarMonth=2026-02",
    );

    await user.click(await screen.findByRole("tab", { name: text.tabs.tastes }));
    await waitFor(() => expect(lastUpdate(onUrlUpdate)?.searchParams.get("tab")).toBe("tastes"));
    await user.click(screen.getByRole("tab", { name: text.tabs.activity }));
    await waitFor(() => expect(lastUpdate(onUrlUpdate)?.searchParams.get("tab")).toBe("activity"));

    const update = lastUpdate(onUrlUpdate);
    expect(update?.options.history).toBe("push");
    expect(update?.searchParams.get("calendarMode")).toBe("books");
    expect(update?.searchParams.get("calendarMonth")).toBe("2026-02");
    expect(
      await screen.findByRole("button", { name: text.calendar.books.nextMonth }),
    ).toHaveAttribute("aria-disabled", "false");
  });
});

describe("StatisticsOverview activity comparison result", () => {
  const COMPARISON = {
    pages: {
      insight: {
        category: "reading",
        code: "pages_read_vs_comparison",
        params: { absoluteDelta: 120, comparisonValue: 300, currentValue: 420, percentDelta: 40 },
        tone: "positive",
      },
      title: "На 120 сторінок більше",
      values: "Поточний період: 420 · Період порівняння: 300",
    },
    reads: {
      insight: {
        category: "reading",
        code: "completed_reads_vs_comparison",
        params: { absoluteDelta: -2, comparisonValue: 9, currentValue: 7, percentDelta: -22.2 },
        tone: "negative",
      },
      title: "На 2 завершені прочитання менше",
      values: "Поточний період: 7 · Період порівняння: 9",
    },
  } satisfies Record<
    DynamicsMetric,
    { insight: ReadingStatisticsInsight; title: string; values: string }
  >;

  const comparisonValues = new RegExp(
    text.dynamics.comparisonResult.values
      .replace("{current}", "\\d+")
      .replace("{comparison}", "\\d+"),
  );

  function withComparisonInsights(): ReadingStatisticsOverview {
    const overview = overviewFixture();
    return {
      ...overview,
      overviewInsights: {
        pages: [...overview.overviewInsights.pages, COMPARISON.pages.insight],
        reads: [COMPARISON.reads.insight],
      },
    };
  }

  async function findComparisonNotices(): Promise<HTMLElement[]> {
    const panel = await activePanel();
    await within(panel).findByText(text.dynamics.title);
    return within(panel)
      .queryAllByRole("status")
      .filter((status) => comparisonValues.test(status.textContent ?? ""));
  }

  it("shows only the pages comparison result when the chart counts pages", async () => {
    overviewResponse = () => jsonResponse(withComparisonInsights());
    renderStatistics("?tab=activity&metric=pages");

    const notices = await findComparisonNotices();

    expect(notices).toHaveLength(1);
    expect(notices[0]).toHaveTextContent(COMPARISON.pages.title);
    expect(notices[0]).toHaveTextContent(COMPARISON.pages.values);
  });

  it("shows the reads comparison result instead of the pages one when the chart counts reads", async () => {
    overviewResponse = () => jsonResponse(withComparisonInsights());
    renderStatistics("?tab=activity");

    const notices = await findComparisonNotices();

    expect(notices).toHaveLength(1);
    expect(notices[0]).toHaveTextContent(COMPARISON.reads.title);
    expect(notices[0]).toHaveTextContent(COMPARISON.reads.values);
  });

  it("shows no comparison result when the period has no comparison observation", async () => {
    renderStatistics("?tab=activity&metric=pages");

    expect(await findComparisonNotices()).toHaveLength(0);
  });
});

describe("StatisticsOverview period change", () => {
  const [captionLead = ""] = text.period.caption.split("{range}");

  const captionPattern = new RegExp(`^${captionLead}`);

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2026-06-15T12:00:00Z"), toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function deferredResponse() {
    let resolve: (response: Response) => void = () => undefined;
    const promise = new Promise<Response>((settle) => {
      resolve = settle;
    });
    return { promise, resolve };
  }

  function overviewOfYear(year: number): ReadingStatisticsOverview {
    const overview = overviewFixture();
    return {
      ...overview,
      period: { ...overview.period, from: `${year}-01-01`, to: `${year}-12-31` },
    };
  }

  function periodToolbar(): HTMLElement {
    return screen.getByRole("region", { name: text.period.toolbarLabel });
  }

  async function findWeekdayRow(weekday: string): Promise<HTMLElement> {
    const list = await screen.findByRole("list", { name: text.habits.weekdays.title });
    return within(list).getByRole("button", { name: weekday });
  }

  async function renderYear2025() {
    overviewResponse = () => jsonResponse(overviewOfYear(2025));
    const view = renderStatistics("?period=year&year=2025");
    expect(await within(periodToolbar()).findByText(captionPattern)).toHaveTextContent("2025");
    return view;
  }

  async function switchYearTo2026(): Promise<(response: Response) => void> {
    const user = userEvent.setup();
    const pending = deferredResponse();
    overviewResponse = () => pending.promise;

    await user.click(screen.getByRole("button", { name: text.period.yearLabel }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "2026" }),
    );

    await waitFor(() => expect(overviewRequests().at(-1)).toContain("year=2026"));
    return pending.resolve;
  }

  it("freezes the previous year's results behind a status while the new year loads, leaving the period controls usable", async () => {
    await renderYear2025();
    await switchYearTo2026();

    const status = await screen.findByText(text.states.periodChanging);

    expect(status.closest("[role='status']")).not.toBeNull();
    expect(screen.getByRole("tablist").closest("[inert]")).not.toBeNull();
    const yearControl = screen.getByRole("button", { name: text.period.yearLabel });
    expect(yearControl).toBeEnabled();
    expect(yearControl.closest("[inert]")).toBeNull();
  });

  it("drops the period caption while the shown results still belong to the previous year", async () => {
    await renderYear2025();
    await switchYearTo2026();

    await screen.findByText(text.states.periodChanging);

    expect(within(periodToolbar()).queryByText(captionPattern)).toBeNull();
  });

  it("lifts the freeze and captions the new year once its response arrives", async () => {
    await renderYear2025();
    const respond = await switchYearTo2026();
    await screen.findByText(text.states.periodChanging);

    respond(jsonResponse(overviewOfYear(2026)));

    await waitFor(() =>
      expect(within(periodToolbar()).getByText(captionPattern)).toHaveTextContent("2026"),
    );
    expect(within(periodToolbar()).getByText(captionPattern)).not.toHaveTextContent("2025");
    const tablist = screen.getByRole("tablist");
    expect(tablist.closest("[inert]")).toBeNull();
    expect(screen.queryByText(text.states.periodChanging)).toBeNull();
  });

  it("keeps the results interactive with the refreshing note during a same-period background refetch", async () => {
    const { queryClient } = await renderYear2025();
    const pending = deferredResponse();
    overviewResponse = () => pending.promise;

    act(() => {
      void queryClient.invalidateQueries();
    });

    expect(await screen.findByText(text.states.refreshing)).toBeInTheDocument();
    const tablist = screen.getByRole("tablist");
    expect(tablist.closest("[inert]")).toBeNull();
    expect(screen.queryByText(text.states.periodChanging)).toBeNull();
  });

  it("replaces the frozen previous year with the first-load error when the new year fails", async () => {
    await renderYear2025();
    const respond = await switchYearTo2026();
    await screen.findByText(text.states.periodChanging);

    respond(jsonResponse({ message: "boom" }, 500));

    expect(await screen.findByRole("alert")).toHaveTextContent(text.states.error.title);
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("returns the weekday pick to the most active weekday once the new year arrives", async () => {
    const user = userEvent.setup();
    await renderYear2025();
    await user.click(screen.getByRole("tab", { name: text.tabs.activity }));
    await user.click(await findWeekdayRow("вівторок"));
    expect(await findWeekdayRow("вівторок")).toHaveAttribute("aria-pressed", "true");

    const respond = await switchYearTo2026();
    await screen.findByText(text.states.periodChanging);
    respond(jsonResponse(overviewOfYear(2026)));

    await waitFor(() =>
      expect(within(periodToolbar()).getByText(captionPattern)).toHaveTextContent("2026"),
    );
    expect(await findWeekdayRow("понеділок")).toHaveAttribute("aria-pressed", "true");
    expect(await findWeekdayRow("вівторок")).toHaveAttribute("aria-pressed", "false");
  });
});

describe("StatisticsOverview long calendar", () => {
  const RANGES = {
    calendar: { from: "2024-01-15", to: "2026-03-10" },
    newestWindow: { from: "2025-04-01", to: "2026-03-10" },
    previousWindow: { from: "2024-04-01", to: "2025-03-31" },
  } as const;

  function overviewOverTwoYears(): ReadingStatisticsOverview {
    const overview = overviewFixture();
    const days = eachDayOfInterval({
      end: parseISO(RANGES.calendar.to),
      start: parseISO(RANGES.calendar.from),
    }).map((day) => {
      const date = format(day, "yyyy-MM-dd");
      return calendarDayFixture({ date, drilldown: { date, kind: "reading_day" } });
    });
    return {
      ...overview,
      calendar: {
        ...overview.calendar,
        days,
        displayRange: RANGES.calendar,
        metricRange: RANGES.calendar,
      },
    };
  }

  function windowLabel(visible: { from: string; to: string }): string {
    const rangeLabel = formatDayRange({ ...visible, locale: "uk" }) ?? "";
    return text.calendar.heatmap.windowRange.replace("{range}", rangeLabel).replace(/\s+/g, " ");
  }

  async function renderNewestWindow() {
    overviewResponse = () => jsonResponse(overviewOverTwoYears());
    const view = renderStatistics("?tab=activity");
    expect(await screen.findByText(windowLabel(RANGES.newestWindow))).toBeInTheDocument();
    return view;
  }

  it("pages a calendar longer than a year back by twelve months without refetching the overview", async () => {
    const user = userEvent.setup();
    await renderNewestWindow();

    await user.click(screen.getByRole("button", { name: text.calendar.heatmap.previousWindow }));

    expect(await screen.findByText(windowLabel(RANGES.previousWindow))).toBeInTheDocument();
    expect(screen.queryByText(windowLabel(RANGES.newestWindow))).not.toBeInTheDocument();
    expect(overviewRequests()).toHaveLength(1);
    expect((await activePanel()).childElementCount).toBe(3);
  });

  it("keeps the paged window in the URL as its last month, replacing the history entry", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = await renderNewestWindow();

    await user.click(screen.getByRole("button", { name: text.calendar.heatmap.previousWindow }));

    await waitFor(() =>
      expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get("calendarMonth")).toBe("2025-03"),
    );
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].options.history).toBe("replace");
  });

  it("opens the books calendar on the last month of the paged window and returns to the same window", async () => {
    const user = userEvent.setup();
    await renderNewestWindow();
    await user.click(screen.getByRole("button", { name: text.calendar.heatmap.previousWindow }));
    await screen.findByText(windowLabel(RANGES.previousWindow));

    await user.click(screen.getByRole("radio", { name: text.calendar.modes.books }));

    expect(
      await screen.findByText(formatMonthKey("2025-03", "uk").replace(/\s+/g, " ")),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: text.calendar.modes.activity }));

    expect(await screen.findByText(windowLabel(RANGES.previousWindow))).toBeInTheDocument();
  });
});
