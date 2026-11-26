import type {
  HomeActiveBooksPage,
  HomeAttentionGroup,
  HomeAttentionView,
  HomeGoalSection,
  HomeNextReadView,
  HomeReadingView,
  HomeReadingWeek,
  LibraryOverviewView,
  QuotesOverviewView,
} from "@app/shared";
import type { ComponentProps } from "react";

import { defaultUserProfileSettings } from "@app/shared";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeQuote } from "@/features/quotes/model/quotes.fixtures";
import { makeReadingGoalMetrics } from "@/features/reading-goals/model/reading-goals.fixtures";
import messages from "@/messages/uk.json";
import {
  createTestQueryClient,
  mockIntersectionObserver,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  within,
} from "@/test-utils";

import { HomeDashboard } from "./home-dashboard";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

mockIntersectionObserver();

const home = messages.home;
const SERVER_TODAY = "2026-11-25";
const ACTIVE_BOOK_ID = "eeeeeeee-0000-4000-8000-000000000001";
const CANDIDATE_BOOK_ID = "eeeeeeee-0000-4000-8000-000000000002";
const GOAL_ID = "eeeeeeee-0000-4000-8000-000000000003";
const ACTIVE_BOOK_TITLE = "Варта! Варта!";
const CANDIDATE_TITLE = "Нейромант";
const GOAL_NAME = "Зимове читання";

type HomeFixtures = {
  activeBooks: HomeActiveBooksPage;
  attention: () => Response;
  library: LibraryOverviewView;
  nextRead: HomeNextReadView;
  quotes: QuotesOverviewView;
  reading: () => Response;
};

const fetchMock = vi.fn();
let fixtures: HomeFixtures;

function activeBooksPage(): HomeActiveBooksPage {
  return {
    items: [
      {
        authors: [{ id: "author-1", name: "Террі Пратчетт" }],
        cover: null,
        currentPage: 120,
        cycleStartedAt: "2026-11-01",
        id: ACTIVE_BOOK_ID,
        lastProgressAt: "2026-11-24",
        pagesCount: 300,
        progressPercent: 40,
        readingStatus: "reading",
        series: null,
        title: ACTIVE_BOOK_TITLE,
      },
    ],
    nextCursor: null,
    total: 1,
  };
}

function activeGoal(): HomeGoalSection {
  return {
    activeGoalsCount: 1,
    primaryGoal: {
      contextActions: [],
      deadline: "2026-12-31",
      goalId: GOAL_ID,
      listName: null,
      metrics: makeReadingGoalMetrics({
        completedCount: 4,
        progressPercent: 40,
        remainingCount: 6,
      }),
      name: GOAL_NAME,
      status: "active",
      targetCount: 10,
    },
    recentCompletion: null,
  };
}

function emptyActiveBooksPage(): HomeActiveBooksPage {
  return { items: [], nextCursor: null, total: 0 };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function libraryOverview(total: number): LibraryOverviewView {
  return {
    recentlyAdded: [],
    summary: {
      borrowed: 0,
      favorites: 0,
      finished: 0,
      inTransit: 0,
      reading: total === 0 ? 0 : 1,
      series: 0,
      solo: total,
      total,
      wantToBuy: 0,
      wantToRead: 0,
    },
    topGenres: [],
    topTags: [],
  };
}

function nextReadView(): HomeNextReadView {
  return {
    candidates: [
      {
        action: "start",
        book: {
          authors: [{ id: "author-2", name: "Вільям Ґібсон" }],
          cover: null,
          currentPage: null,
          id: CANDIDATE_BOOK_ID,
          isFavorite: false,
          ownershipStatus: "owned",
          pagesCount: 320,
          progressPercent: null,
          readingStatus: "want_to_read",
          title: CANDIDATE_TITLE,
        },
        queue: null,
        reason: "planned",
        series: null,
        source: "library",
      },
    ],
    unavailableSources: [],
  };
}

function noGoal(): HomeGoalSection {
  return { activeGoalsCount: 0, primaryGoal: null, recentCompletion: null };
}

function readingView({
  activeBooks = activeBooksPage(),
  goal = activeGoal(),
  hasReadingHistory = true,
}: {
  activeBooks?: HomeActiveBooksPage;
  goal?: HomeGoalSection;
  hasReadingHistory?: boolean;
} = {}): HomeReadingView {
  return {
    currentlyReading: { data: activeBooks, status: "available" },
    readingGoal: { data: goal, status: "available" },
    readingWeek: { data: readingWeek(hasReadingHistory), status: "available" },
    today: SERVER_TODAY,
  };
}

function readingWeek(hasReadingHistory: boolean): HomeReadingWeek {
  return {
    activeDays: 0,
    currentStreak: { availability: "available", data: null },
    days: [
      { booksCount: 0, date: "2026-11-23", pagesRead: 0, status: "inactive" },
      { booksCount: 0, date: "2026-11-24", pagesRead: 0, status: "inactive" },
      { booksCount: 0, date: "2026-11-25", pagesRead: 0, status: "inactive" },
      { booksCount: null, date: "2026-11-26", pagesRead: null, status: "future" },
      { booksCount: null, date: "2026-11-27", pagesRead: null, status: "future" },
      { booksCount: null, date: "2026-11-28", pagesRead: null, status: "future" },
      { booksCount: null, date: "2026-11-29", pagesRead: null, status: "future" },
    ],
    hasReadingHistory,
    pages: { quality: "exact", value: 0 },
    period: { from: "2026-11-23", to: "2026-11-29" },
    timezone: "Europe/Kyiv",
    today: SERVER_TODAY,
    weekStartDay: "monday",
  };
}

function serverError(): Response {
  return jsonResponse({ message: "boom" }, 500);
}

const pickupGroup: HomeAttentionGroup = {
  count: 2,
  dueDate: "2026-11-27",
  id: "delivery_ready_for_pickup",
  reason: "delivery_ready_for_pickup",
  severity: "high",
  unit: "parcels",
};

const criticalPickupGroup: HomeAttentionGroup = {
  count: 1,
  dueDate: "2026-11-25",
  expiredCount: 0,
  id: "delivery_pickup_expiring",
  reason: "delivery_pickup_expiring",
  severity: "critical",
  unit: "parcels",
};

function attentionView(groups: HomeAttentionGroup[]): HomeAttentionView {
  return { groups, unavailableSources: [] };
}

function busyHome(): HomeFixtures {
  return {
    activeBooks: activeBooksPage(),
    attention: () => jsonResponse(attentionView([pickupGroup])),
    library: libraryOverview(12),
    nextRead: nextReadView(),
    quotes: { memoryQuote: makeQuote(), postFinish: null },
    reading: () => jsonResponse(readingView()),
  };
}

function emptyHome(reading: HomeReadingView): HomeFixtures {
  return {
    activeBooks: emptyActiveBooksPage(),
    attention: () => jsonResponse(attentionView([])),
    library: libraryOverview(0),
    nextRead: { candidates: [], unavailableSources: [] },
    quotes: { memoryQuote: null, postFinish: null },
    reading: () => jsonResponse(reading),
  };
}

function findLinkIn(regionName: string, linkName: RegExp | string) {
  return waitFor(() => within(region(regionName)).getByRole("link", { name: linkName }));
}

function region(name: string) {
  return screen.getByRole("region", { name });
}

function requestsTo(path: string) {
  return fetchMock.mock.calls.filter(
    ([input]) => new URL(String(input), "http://localhost").pathname === path,
  );
}

async function waitUntilSettled() {
  await screen.findByText(home.subtitle.emptyLibrary);
  await waitFor(() =>
    expect(screen.queryByRole("region", { name: home.attention.title })).not.toBeInTheDocument(),
  );
  await waitFor(() =>
    expect(screen.queryByRole("region", { name: home.memory.title })).not.toBeInTheDocument(),
  );
}

beforeEach(() => {
  fixtures = busyHome();
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (method !== "GET") return Promise.reject(new Error(`unexpected ${method} ${url}`));
    if (url.includes("/api/profile/settings"))
      return Promise.resolve(jsonResponse(defaultUserProfileSettings));
    if (url.includes("/api/books/overview")) return Promise.resolve(jsonResponse(fixtures.library));
    if (url.includes("/api/quotes/overview")) return Promise.resolve(jsonResponse(fixtures.quotes));
    if (url.includes("/api/notes/books/overview"))
      return Promise.resolve(jsonResponse({ memoryNote: null, postFinish: null }));
    if (url.includes("/api/home/reading/books"))
      return Promise.resolve(jsonResponse(fixtures.activeBooks));
    if (url.includes("/api/home/reading")) return Promise.resolve(fixtures.reading());
    if (url.includes("/api/home/next-read"))
      return Promise.resolve(jsonResponse(fixtures.nextRead));
    if (url.includes("/api/home/attention")) return Promise.resolve(fixtures.attention());
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("HomeDashboard zones", () => {
  it("renders the reading, week, goal, next read, attention and memory zones", async () => {
    renderWithProviders(<HomeDashboard />);

    expect(await findLinkIn(home.reading.title, ACTIVE_BOOK_TITLE)).toBeInTheDocument();
    expect(within(region(home.week.title)).getAllByRole("listitem")).toHaveLength(7);
    expect(await findLinkIn(home.goal.title, GOAL_NAME)).toBeInTheDocument();
    expect(await findLinkIn(home.nextRead.title, CANDIDATE_TITLE)).toBeInTheDocument();
    expect(await findLinkIn(home.attention.title, /Можна забирати: 2 посилки/)).toBeInTheDocument();
    expect(
      await waitFor(() => within(region(home.memory.title)).getByText(/убивця розуму/)),
    ).toBeInTheDocument();
  });

  it("keeps the add book action in the header outside onboarding", async () => {
    renderWithProviders(<HomeDashboard />);

    await screen.findByRole("link", { name: ACTIVE_BOOK_TITLE });

    expect(screen.getByRole("link", { name: home.actions.addBook })).toHaveAttribute(
      "href",
      "/books/new",
    );
    expect(screen.queryByRole("region", { name: home.onboarding.title })).not.toBeInTheDocument();
  });

  it("no longer shows the old summary cards, library progress or delivery widget", async () => {
    renderWithProviders(<HomeDashboard />);

    await screen.findByRole("link", { name: CANDIDATE_TITLE });

    expect(screen.queryByText("Моя бібліотека")).not.toBeInTheDocument();
    expect(screen.queryByText("Прогрес читання")).not.toBeInTheDocument();
    expect(screen.queryByText("Доставки в дорозі")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "До бібліотеки" })).not.toBeInTheDocument();
  });
});

describe("HomeDashboard onboarding", () => {
  it("shows onboarding with one add book link when the library and everything else is empty", async () => {
    fixtures = emptyHome(
      readingView({
        activeBooks: emptyActiveBooksPage(),
        goal: noGoal(),
        hasReadingHistory: false,
      }),
    );

    renderWithProviders(<HomeDashboard />);

    const onboarding = await screen.findByRole("region", { name: home.onboarding.title });
    expect(within(onboarding).getByAltText("")).toHaveAttribute(
      "src",
      expect.stringContaining("home-reading-empty"),
    );
    const addBookLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href") === "/books/new");
    expect(addBookLinks).toHaveLength(1);
    expect(addBookLinks[0]).toHaveAccessibleName(home.onboarding.action);
    expect(screen.queryByRole("link", { name: home.actions.addBook })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: home.reading.title })).not.toBeInTheDocument();
  });

  it("keeps the goal instead of onboarding when an empty library has an active goal", async () => {
    fixtures = emptyHome(
      readingView({
        activeBooks: emptyActiveBooksPage(),
        goal: activeGoal(),
        hasReadingHistory: false,
      }),
    );

    renderWithProviders(<HomeDashboard />);

    expect(await findLinkIn(home.goal.title, GOAL_NAME)).toBeInTheDocument();
    await waitUntilSettled();
    expect(screen.queryByRole("region", { name: home.onboarding.title })).not.toBeInTheDocument();
  });

  it("keeps the reading week instead of onboarding when an empty library has reading history", async () => {
    fixtures = emptyHome(
      readingView({ activeBooks: emptyActiveBooksPage(), goal: noGoal(), hasReadingHistory: true }),
    );

    renderWithProviders(<HomeDashboard />);

    expect(await screen.findByText("0 сторінок за тиждень")).toBeInTheDocument();
    await waitUntilSettled();
    expect(region(home.week.title)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: home.onboarding.title })).not.toBeInTheDocument();
  });
});

describe("HomeDashboard attention", () => {
  it("shows the attention error with a retry while the other zones still render", async () => {
    fixtures = { ...busyHome(), attention: serverError };

    renderWithProviders(<HomeDashboard />);

    expect(
      await waitFor(() => within(region(home.attention.title)).getByRole("alert")),
    ).toHaveTextContent(home.attention.error.title);
    expect(await findLinkIn(home.reading.title, ACTIVE_BOOK_TITLE)).toBeInTheDocument();
    expect(await findLinkIn(home.nextRead.title, CANDIDATE_TITLE)).toBeInTheDocument();

    await userEvent.click(
      within(region(home.attention.title)).getByRole("button", {
        name: home.attention.error.retry,
      }),
    );

    await waitFor(() => expect(requestsTo("/api/home/attention")).toHaveLength(2));
  });

  it("puts a critical group in the banner and not in the attention list", async () => {
    fixtures = {
      ...busyHome(),
      attention: () => jsonResponse(attentionView([criticalPickupGroup, pickupGroup])),
    };

    renderWithProviders(<HomeDashboard />);

    const banner = await screen.findByRole("region", { name: home.attention.bannerLabel });
    expect(
      within(banner).getByRole("link", { name: /Скоро завершиться зберігання: 1 посилка/ }),
    ).toBeInTheDocument();
    expect(await findLinkIn(home.attention.title, /Можна забирати: 2 посилки/)).toBeInTheDocument();
    expect(
      within(region(home.attention.title)).queryByRole("link", {
        name: /Скоро завершиться зберігання/,
      }),
    ).not.toBeInTheDocument();
  });

  it("hides the attention zone when nothing needs attention and every source answered", async () => {
    fixtures = { ...busyHome(), attention: () => jsonResponse(attentionView([])) };

    renderWithProviders(<HomeDashboard />);

    await waitFor(() =>
      expect(screen.queryByRole("region", { name: home.attention.title })).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("region", { name: home.attention.bannerLabel }),
    ).not.toBeInTheDocument();
  });
});

describe("HomeDashboard currently reading", () => {
  it("shows the reading error when the section is unavailable while the goal still renders", async () => {
    const view = readingView();
    fixtures = {
      ...busyHome(),
      reading: () =>
        jsonResponse({
          ...view,
          currentlyReading: { reason: "SOURCE_FAILED", status: "unavailable" },
        }),
    };

    renderWithProviders(<HomeDashboard />);

    expect(
      await waitFor(() => within(region(home.reading.title)).getByRole("alert")),
    ).toHaveTextContent(home.reading.error.title);
    expect(await findLinkIn(home.goal.title, GOAL_NAME)).toBeInTheDocument();
  });

  it("keeps the previous books under a stale notice when a refetch fails", async () => {
    const queryClient = createTestQueryClient();
    renderWithProviders(<HomeDashboard />, { queryClient });
    await findLinkIn(home.reading.title, ACTIVE_BOOK_TITLE);
    expect(
      within(region(home.reading.title)).queryByText(home.stale.message),
    ).not.toBeInTheDocument();

    fixtures = { ...fixtures, reading: serverError };
    await act(() => queryClient.refetchQueries({ exact: true, queryKey: ["/api/home/reading"] }));

    expect(
      await waitFor(() => within(region(home.reading.title)).getByText(home.stale.message)),
    ).toBeInTheDocument();
    expect(
      within(region(home.reading.title)).getByRole("link", { name: ACTIVE_BOOK_TITLE }),
    ).toBeInTheDocument();
  });
});
